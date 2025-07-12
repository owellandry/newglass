use anyhow::Result;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use crate::api::AppState;
use crate::core::events::AppEvent;
use crate::core::session::{Session, SessionStatus, SessionType};
use crate::repositories::{
    message::{Message, MessageRole},
    transcript::{AudioSource, Transcript},
};
use crate::repositories::Repository;

// Request/Response types
#[derive(Debug, Deserialize)]
pub struct CreateSessionRequest {
    pub user_id: Option<String>,
    pub session_type: SessionType,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSessionRequest {
    pub status: Option<SessionStatus>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub session_id: Uuid,
    pub content: String,
    pub role: Option<MessageRole>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMessageRequest {
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct SearchRequest {
    pub query: String,
    pub session_id: Option<Uuid>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }
    
    pub fn error(error: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
        }
    }
}

// Session handlers
pub async fn get_sessions(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<Vec<Session>>>, StatusCode> {
    let user_id = params.get("user_id");
    
    let sessions = if let Some(user_id) = user_id {
        state.session_repo.find_by_user_id(user_id).await
    } else {
        state.session_repo.find_active_sessions().await
    };
    
    match sessions {
        Ok(sessions) => Ok(Json(ApiResponse::success(sessions))),
        Err(e) => {
            tracing::error!("Failed to get sessions: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_session(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<Session>>, StatusCode> {
    match state.session_repo.find_by_id(&id).await {
        Ok(Some(session)) => Ok(Json(ApiResponse::success(session))),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!("Failed to get session {}: {}", id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn create_session(
    State(state): State<AppState>,
    Json(request): Json<CreateSessionRequest>,
) -> Result<Json<ApiResponse<Session>>, StatusCode> {
    let session = Session::new(
        request.user_id,
        request.session_type,
        request.metadata,
    );
    
    match state.session_repo.create(&session).await {
        Ok(_) => Ok(Json(ApiResponse::success(session))),
        Err(e) => {
            tracing::error!("Failed to create session: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn update_session(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateSessionRequest>,
) -> Result<Json<ApiResponse<Session>>, StatusCode> {
    let mut session = match state.session_repo.find_by_id(&id).await {
        Ok(Some(session)) => session,
        Ok(None) => return Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!("Failed to find session {}: {}", id, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    if let Some(status) = request.status {
        session.status = status;
    }
    
    if let Some(metadata) = request.metadata {
        session.metadata = metadata.into_iter()
            .map(|(k, v)| (k, v.to_string()))
            .collect();
    }
    
    session.updated_at = chrono::Utc::now();
    
    match state.session_repo.update(&session).await {
        Ok(_) => Ok(Json(ApiResponse::success(session))),
        Err(e) => {
            tracing::error!("Failed to update session {}: {}", id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn delete_session(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match state.session_repo.delete(&id).await {
        Ok(_) => Ok(Json(ApiResponse::success(()))),
        Err(e) => {
            tracing::error!("Failed to delete session {}: {}", id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn start_session(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    // Start all services for this session
    let start_results = tokio::join!(
        state.audio_service.start_recording(id),
        state.stt_service.start_session(id),
        state.chat_service.start_session(id),
        state.summary_service.start_session(id)
    );
    
    if let Err(e) = start_results.0 {
        tracing::error!("Failed to start audio service for session {}: {}", id, e);
    }
    if let Err(e) = start_results.1 {
        tracing::error!("Failed to start STT service for session {}: {}", id, e);
    }
    if let Err(e) = start_results.2 {
        tracing::error!("Failed to start chat service for session {}: {}", id, e);
    }
    if let Err(e) = start_results.3 {
        tracing::error!("Failed to start summary service for session {}: {}", id, e);
    }
    
    // Update session status
    if let Err(e) = state.session_repo.update_status(id, SessionStatus::Active).await {
        tracing::error!("Failed to update session status: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }
    
    Ok(Json(ApiResponse::success(())))
}

pub async fn end_session(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    // End all services for this session
    let end_results = tokio::join!(
        state.audio_service.stop_recording(),
        state.stt_service.end_session(id),
        state.chat_service.end_session(id),
        state.summary_service.end_session(id)
    );
    
    if let Err(e) = end_results.0 {
        tracing::error!("Failed to stop audio service: {}", e);
    }
    if let Err(e) = end_results.1 {
        tracing::error!("Failed to end STT service for session {}: {}", id, e);
    }
    if let Err(e) = end_results.2 {
        tracing::error!("Failed to end chat service for session {}: {}", id, e);
    }
    if let Err(e) = end_results.3 {
        tracing::error!("Failed to end summary service for session {}: {}", id, e);
    }
    
    // Update session status
    if let Err(e) = state.session_repo.update_status(id, SessionStatus::Ended).await {
        tracing::error!("Failed to update session status: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }
    
    Ok(Json(ApiResponse::success(())))
}

// Audio handlers
pub async fn start_audio_recording(
    State(state): State<AppState>,
    Json(session_id): Json<Uuid>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match state.audio_service.start_recording(session_id).await {
        Ok(_) => Ok(Json(ApiResponse::success(()))),
        Err(e) => {
            tracing::error!("Failed to start audio recording: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn stop_audio_recording(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match state.audio_service.stop_recording().await {
        Ok(_) => Ok(Json(ApiResponse::success(()))),
        Err(e) => {
            tracing::error!("Failed to stop audio recording: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_audio_status(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<bool>>, StatusCode> {
    let is_recording = state.audio_service.is_recording().await;
    Ok(Json(ApiResponse::success(is_recording)))
}

// Transcript handlers
pub async fn get_transcripts(
    State(state): State<AppState>,
    Path(session_id): Path<Uuid>,
) -> Result<Json<ApiResponse<Vec<Transcript>>>, StatusCode> {
    match state.transcript_repo.find_by_session_id(session_id).await {
        Ok(transcripts) => Ok(Json(ApiResponse::success(transcripts))),
        Err(e) => {
            tracing::error!("Failed to get transcripts for session {}: {}", session_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn search_transcripts(
    State(state): State<AppState>,
    Json(request): Json<SearchRequest>,
) -> Result<Json<ApiResponse<Vec<Transcript>>>, StatusCode> {
    let transcripts = if let Some(session_id) = request.session_id {
        // Search within specific session
        state.transcript_repo.find_by_session_id(session_id).await
            .map(|transcripts| {
                transcripts.into_iter()
                    .filter(|t| t.text.to_lowercase().contains(&request.query.to_lowercase()))
                    .collect()
            })
    } else {
        // Global search
        state.transcript_repo.search_text(&request.query).await
    };
    
    match transcripts {
        Ok(mut transcripts) => {
            if let Some(limit) = request.limit {
                transcripts.truncate(limit as usize);
            }
            Ok(Json(ApiResponse::success(transcripts)))
        },
        Err(e) => {
            tracing::error!("Failed to search transcripts: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// Message handlers
pub async fn get_messages(
    State(state): State<AppState>,
    Path(session_id): Path<Uuid>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<Vec<Message>>>, StatusCode> {
    let limit = params.get("limit")
        .and_then(|l| l.parse::<i64>().ok());
    
    match state.message_repo.find_conversation_history(session_id, limit).await {
        Ok(messages) => Ok(Json(ApiResponse::success(messages))),
        Err(e) => {
            tracing::error!("Failed to get messages for session {}: {}", session_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn send_message(
    State(state): State<AppState>,
    Json(request): Json<SendMessageRequest>,
) -> Result<Json<ApiResponse<Message>>, StatusCode> {
    let role = request.role.unwrap_or(MessageRole::User);
    
    let message = Message {
        id: Uuid::new_v4(),
        session_id: request.session_id,
        role: role.clone(),
        content: request.content.clone(),
        model: None,
        tokens_used: None,
        response_time: None,
        created_at: chrono::Utc::now(),
        metadata: None,
        parent_message_id: None,
        is_edited: false,
        edit_count: 0,
    };
    
    // Store message
    if let Err(e) = state.message_repo.create(&message).await {
        tracing::error!("Failed to store message: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }
    
    // Send to chat service if it's a user message
    if matches!(role, MessageRole::User) {
        if let Err(e) = state.chat_service.process_message(request.session_id, request.content).await {
            tracing::error!("Failed to process chat message: {}", e);
        }
    }
    
    Ok(Json(ApiResponse::success(message)))
}

pub async fn update_message(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateMessageRequest>,
) -> Result<Json<ApiResponse<Message>>, StatusCode> {
    let mut message = match state.message_repo.find_by_id(&id).await {
        Ok(Some(message)) => message,
        Ok(None) => return Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!("Failed to find message {}: {}", id, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    message.content = request.content;
    message.is_edited = true;
    message.edit_count += 1;
    
    match state.message_repo.update(&message).await {
        Ok(_) => Ok(Json(ApiResponse::success(message))),
        Err(e) => {
            tracing::error!("Failed to update message {}: {}", id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn delete_message(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match state.message_repo.delete(&id).await {
        Ok(_) => Ok(Json(ApiResponse::success(()))),
        Err(e) => {
            tracing::error!("Failed to delete message {}: {}", id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// Summary handlers
pub async fn get_summary(
    State(state): State<AppState>,
    Path(session_id): Path<Uuid>,
) -> Result<Json<ApiResponse<Option<crate::core::events::SummaryData>>>, StatusCode> {
    let summary = state.summary_service.get_last_summary(session_id).await;
    Ok(Json(ApiResponse::success(summary)))
}

pub async fn generate_summary(
    State(state): State<AppState>,
    Path(session_id): Path<Uuid>,
) -> Result<Json<ApiResponse<crate::core::events::SummaryData>>, StatusCode> {
    match state.summary_service.force_summary(session_id).await {
        Ok(summary) => Ok(Json(ApiResponse::success(summary))),
        Err(e) => {
            tracing::error!("Failed to generate summary for session {}: {}", session_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// Statistics handlers
pub async fn get_session_stats(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<HashMap<String, i64>>>, StatusCode> {
    match state.session_repo.get_session_stats().await {
        Ok(stats) => Ok(Json(ApiResponse::success(stats))),
        Err(e) => {
            tracing::error!("Failed to get session stats: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_usage_stats(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<crate::repositories::message::ModelUsage>>, StatusCode> {
    match state.message_repo.get_model_usage_stats().await {
        Ok(stats) => {
            // Return the first model usage stats or create empty one
            let usage = stats.into_iter().next().unwrap_or(
                crate::repositories::message::ModelUsage {
                    model: "none".to_string(),
                    usage_count: 0,
                    total_tokens: 0,
                    avg_response_time: None,
                }
            );
            Ok(Json(ApiResponse::success(usage)))
        },
        Err(e) => {
            tracing::error!("Failed to get usage stats: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}