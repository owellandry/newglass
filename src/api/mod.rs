pub mod routes;
pub mod websocket;
pub mod middleware;
pub mod handlers;

use anyhow::Result;
use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tokio::sync::broadcast;
use tower::ServiceBuilder;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::config::ServerConfig;
use crate::core::events::AppEvent;
use crate::repositories::{DbPool, SessionRepository, TranscriptRepository, MessageRepository};
use crate::services::{
    AudioService, SttService, ChatService, SummaryService,
};

pub use routes::*;
pub use websocket::*;
pub use handlers::*;

/// Shared application state for API handlers
#[derive(Clone)]
pub struct AppState {
    pub db_pool: DbPool,
    pub session_repo: Arc<SessionRepository>,
    pub transcript_repo: Arc<TranscriptRepository>,
    pub message_repo: Arc<MessageRepository>,
    pub audio_service: Arc<AudioService>,
    pub stt_service: Arc<SttService>,
    pub chat_service: Arc<ChatService>,
    pub summary_service: Arc<SummaryService>,
    pub event_tx: broadcast::Sender<AppEvent>,
    pub config: ServerConfig,
}

/// API Server that handles HTTP and WebSocket connections
pub struct ApiServer {
    app_state: AppState,
    config: ServerConfig,
}

impl ApiServer {
    pub fn new(
        db_pool: DbPool,
        session_repo: Arc<SessionRepository>,
        transcript_repo: Arc<TranscriptRepository>,
        message_repo: Arc<MessageRepository>,
        audio_service: Arc<AudioService>,
        stt_service: Arc<SttService>,
        chat_service: Arc<ChatService>,
        summary_service: Arc<SummaryService>,
        event_tx: broadcast::Sender<AppEvent>,
        config: ServerConfig,
    ) -> Self {
        let app_state = AppState {
            db_pool,
            session_repo,
            transcript_repo,
            message_repo,
            audio_service,
            stt_service,
            chat_service,
            summary_service,
            event_tx,
            config: config.clone(),
        };
        
        Self {
            app_state,
            config,
        }
    }
    
    pub async fn run(self) -> Result<()> {
        let app = self.create_router();
        
        let addr = format!("{}:{}", self.config.host, self.config.port);
        tracing::info!("Starting API server on {}", addr);
        
        let listener = tokio::net::TcpListener::bind(&addr).await?;
        axum::serve(listener, app).await?;
        
        Ok(())
    }
    
    fn create_router(self) -> Router {
        let cors = CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any);
        
        Router::new()
            // Health check
            .route("/health", get(health_check))
            
            // Session management
            .route("/api/sessions", get(get_sessions).post(create_session))
            .route("/api/sessions/:id", get(get_session).put(update_session).delete(delete_session))
            .route("/api/sessions/:id/start", post(start_session))
            .route("/api/sessions/:id/end", post(end_session))
            
            // Audio management
            .route("/api/audio/start", post(start_audio_recording))
            .route("/api/audio/stop", post(stop_audio_recording))
            .route("/api/audio/status", get(get_audio_status))
            
            // Transcription
            .route("/api/transcripts/:session_id", get(get_transcripts))
            .route("/api/transcripts/search", post(search_transcripts))
            
            // Chat/Messages
            .route("/api/messages/:session_id", get(get_messages))
            .route("/api/messages", post(send_message))
            .route("/api/messages/:id", put(update_message).delete(delete_message))
            
            // Summary
            .route("/api/summary/:session_id", get(get_summary).post(generate_summary))
            
            // Statistics
            .route("/api/stats/sessions", get(get_session_stats))
            .route("/api/stats/usage", get(get_usage_stats))
            
            // WebSocket endpoint
            .route("/ws", get(websocket_handler))
            
            // Static files (for web dashboard)
            .route("/", get(serve_dashboard))
            .route("/dashboard/*path", get(serve_static_files))
            
            .layer(
                ServiceBuilder::new()
                    .layer(TraceLayer::new_for_http())
                    .layer(cors)
            )
            .with_state(self.app_state)
    }
}

// Basic health check handler
async fn health_check() -> &'static str {
    "OK"
}

// Dashboard handler
async fn serve_dashboard() -> axum::response::Html<&'static str> {
    axum::response::Html(include_str!("../../../web/index.html"))
}

// Static files handler
async fn serve_static_files(
    axum::extract::Path(path): axum::extract::Path<String>,
) -> Result<axum::response::Response, axum::http::StatusCode> {
    // In a real implementation, you would serve actual static files
    // For now, return a simple response
    match path.as_str() {
        "app.js" => Ok(axum::response::Response::builder()
            .header("content-type", "application/javascript")
            .body("console.log('NewGlass Dashboard');".into())
            .unwrap()),
        "style.css" => Ok(axum::response::Response::builder()
            .header("content-type", "text/css")
            .body("body { font-family: Arial, sans-serif; }".into())
            .unwrap()),
        _ => Err(axum::http::StatusCode::NOT_FOUND),
    }
}