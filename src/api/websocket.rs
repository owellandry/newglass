use anyhow::Result;
use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, State},
    response::Response,
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::api::AppState;
use crate::core::events::AppEvent;

/// WebSocket message types for client-server communication
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum WsMessage {
    // Client to Server
    Subscribe { session_id: Option<Uuid> },
    Unsubscribe { session_id: Option<Uuid> },
    StartSession { session_id: Uuid },
    EndSession { session_id: Uuid },
    SendMessage { session_id: Uuid, content: String },
    StartAudio { session_id: Uuid },
    StopAudio,
    RequestSummary { session_id: Uuid },
    Ping,
    
    // Server to Client
    Pong,
    SessionStarted { session_id: Uuid },
    SessionEnded { session_id: Uuid },
    AudioStarted { session_id: Uuid },
    AudioStopped,
    TranscriptionReceived {
        session_id: Uuid,
        speaker: String,
        text: String,
        confidence: Option<f32>,
        audio_source: String,
    },
    MessageReceived {
        session_id: Uuid,
        role: String,
        content: String,
        model: Option<String>,
    },
    SummaryGenerated {
        session_id: Uuid,
        summary: String,
    },
    ErrorOccurred {
        session_id: Option<Uuid>,
        error: String,
        service: String,
    },
    ServiceStatusUpdate {
        service: String,
        status: String,
        details: Option<HashMap<String, serde_json::Value>>,
    },
}

/// WebSocket connection manager
pub struct WebSocketManager {
    connections: Arc<RwLock<HashMap<Uuid, WebSocketConnection>>>,
    event_rx: broadcast::Receiver<AppEvent>,
}

#[derive(Debug, Clone)]
struct WebSocketConnection {
    id: Uuid,
    subscribed_sessions: Vec<Uuid>,
    tx: tokio::sync::mpsc::UnboundedSender<WsMessage>,
}

impl WebSocketManager {
    pub fn new(event_rx: broadcast::Receiver<AppEvent>) -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            event_rx,
        }
    }
    
    pub async fn start_event_broadcaster(&mut self) {
        let connections = self.connections.clone();
        let mut event_rx = self.event_rx.resubscribe();
        
        tokio::spawn(async move {
            while let Ok(event) = event_rx.recv().await {
                let ws_message = match event {
                    AppEvent::AudioCaptured { session_id, .. } => {
                        // Don't broadcast raw audio data
                        continue;
                    },
                    AppEvent::TranscriptionReceived { session_id, result } => {
                        WsMessage::TranscriptionReceived {
                            session_id,
                            speaker: result.speaker,
                            text: result.text,
                            confidence: result.confidence,
                            audio_source: result.audio_source,
                        }
                    },
                    AppEvent::ChatMessageReceived { session_id, message } => {
                        WsMessage::MessageReceived {
                            session_id,
                            role: message.role,
                            content: message.content,
                            model: message.model,
                        }
                    },
                    AppEvent::SummaryGenerated { session_id, summary } => {
                        WsMessage::SummaryGenerated {
                            session_id,
                            summary,
                        }
                    },
                    AppEvent::SessionStarted { session_id } => {
                        WsMessage::SessionStarted { session_id }
                    },
                    AppEvent::SessionEnded { session_id } => {
                        WsMessage::SessionEnded { session_id }
                    },
                    AppEvent::ErrorOccurred { session_id, error, service } => {
                        WsMessage::ErrorOccurred {
                            session_id,
                            error,
                            service,
                        }
                    },
                    AppEvent::StatusUpdate { service, status } => {
                        WsMessage::ServiceStatusUpdate {
                            service,
                            status: format!("{:?}", status),
                            details: None,
                        }
                    },
                    _ => continue,
                };
                
                // Broadcast to relevant connections
                let connections = connections.read().await;
                for connection in connections.values() {
                    if let Err(e) = connection.tx.send(ws_message.clone()) {
                        warn!("Failed to send WebSocket message to connection {}: {}", connection.id, e);
                    }
                }
            }
        });
    }
    
    async fn add_connection(&self, connection: WebSocketConnection) {
        let mut connections = self.connections.write().await;
        connections.insert(connection.id, connection);
    }
    
    async fn remove_connection(&self, connection_id: Uuid) {
        let mut connections = self.connections.write().await;
        connections.remove(&connection_id);
    }
    
    async fn update_subscription(&self, connection_id: Uuid, session_id: Uuid, subscribe: bool) {
        let mut connections = self.connections.write().await;
        if let Some(connection) = connections.get_mut(&connection_id) {
            if subscribe {
                if !connection.subscribed_sessions.contains(&session_id) {
                    connection.subscribed_sessions.push(session_id);
                }
            } else {
                connection.subscribed_sessions.retain(|&id| id != session_id);
            }
        }
    }
}

/// WebSocket handler for incoming connections
pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Response {
    ws.on_upgrade(|socket| handle_websocket(socket, state))
}

async fn handle_websocket(socket: WebSocket, state: AppState) {
    let connection_id = Uuid::new_v4();
    info!("New WebSocket connection: {}", connection_id);
    
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<WsMessage>();
    
    let connection = WebSocketConnection {
        id: connection_id,
        subscribed_sessions: Vec::new(),
        tx,
    };
    
    // Create WebSocket manager for this connection
    let ws_manager = WebSocketManager::new(state.event_tx.subscribe());
    ws_manager.add_connection(connection).await;
    
    // Spawn task to handle outgoing messages
    let outgoing_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let json_msg = match serde_json::to_string(&msg) {
                Ok(json) => json,
                Err(e) => {
                    error!("Failed to serialize WebSocket message: {}", e);
                    continue;
                }
            };
            
            if sender.send(Message::Text(json_msg)).await.is_err() {
                break;
            }
        }
    });
    
    // Handle incoming messages
    let incoming_task = tokio::spawn(async move {
        while let Some(msg) = receiver.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    if let Err(e) = handle_websocket_message(&text, &state, connection_id, &ws_manager).await {
                        error!("Error handling WebSocket message: {}", e);
                    }
                },
                Ok(Message::Binary(_)) => {
                    warn!("Received binary WebSocket message, ignoring");
                },
                Ok(Message::Close(_)) => {
                    info!("WebSocket connection {} closed by client", connection_id);
                    break;
                },
                Err(e) => {
                    error!("WebSocket error for connection {}: {}", connection_id, e);
                    break;
                }
            }
        }
        
        // Clean up connection
        ws_manager.remove_connection(connection_id).await;
        info!("WebSocket connection {} cleaned up", connection_id);
    });
    
    // Wait for either task to complete
    tokio::select! {
        _ = outgoing_task => {},
        _ = incoming_task => {},
    }
}

async fn handle_websocket_message(
    text: &str,
    state: &AppState,
    connection_id: Uuid,
    ws_manager: &WebSocketManager,
) -> Result<()> {
    let message: WsMessage = serde_json::from_str(text)?;
    
    match message {
        WsMessage::Subscribe { session_id } => {
            if let Some(session_id) = session_id {
                ws_manager.update_subscription(connection_id, session_id, true).await;
                info!("Connection {} subscribed to session {}", connection_id, session_id);
            }
        },
        
        WsMessage::Unsubscribe { session_id } => {
            if let Some(session_id) = session_id {
                ws_manager.update_subscription(connection_id, session_id, false).await;
                info!("Connection {} unsubscribed from session {}", connection_id, session_id);
            }
        },
        
        WsMessage::StartSession { session_id } => {
            // Start all services for the session
            let start_results = tokio::join!(
                state.audio_service.start_recording(session_id),
                state.stt_service.start_session(session_id),
                state.chat_service.start_session(session_id),
                state.summary_service.start_session(session_id)
            );
            
            // Update session status
            if let Err(e) = state.session_repo.update_status(session_id, crate::core::session::SessionStatus::Active).await {
                error!("Failed to update session status: {}", e);
            }
            
            // Send confirmation
            let event = AppEvent::SessionStarted { session_id };
            if let Err(e) = state.event_tx.send(event) {
                error!("Failed to send session started event: {}", e);
            }
        },
        
        WsMessage::EndSession { session_id } => {
            // End all services for the session
            let end_results = tokio::join!(
                state.audio_service.stop_recording(),
                state.stt_service.end_session(session_id),
                state.chat_service.end_session(session_id),
                state.summary_service.end_session(session_id)
            );
            
            // Update session status
            if let Err(e) = state.session_repo.update_status(session_id, crate::core::session::SessionStatus::Ended).await {
                error!("Failed to update session status: {}", e);
            }
            
            // Send confirmation
            let event = AppEvent::SessionEnded { session_id };
            if let Err(e) = state.event_tx.send(event) {
                error!("Failed to send session ended event: {}", e);
            }
        },
        
        WsMessage::SendMessage { session_id, content } => {
            if let Err(e) = state.chat_service.process_message(session_id, content).await {
                error!("Failed to process chat message: {}", e);
            }
        },
        
        WsMessage::StartAudio { session_id } => {
            if let Err(e) = state.audio_service.start_recording(session_id).await {
                error!("Failed to start audio recording: {}", e);
            } else {
                let event = AppEvent::StatusUpdate {
                    service: "audio".to_string(),
                    status: crate::core::events::ServiceStatus::Running,
                };
                if let Err(e) = state.event_tx.send(event) {
                    error!("Failed to send audio status event: {}", e);
                }
            }
        },
        
        WsMessage::StopAudio => {
            if let Err(e) = state.audio_service.stop_recording().await {
                error!("Failed to stop audio recording: {}", e);
            } else {
                let event = AppEvent::StatusUpdate {
                    service: "audio".to_string(),
                    status: crate::core::events::ServiceStatus::Stopped,
                };
                if let Err(e) = state.event_tx.send(event) {
                    error!("Failed to send audio status event: {}", e);
                }
            }
        },
        
        WsMessage::RequestSummary { session_id } => {
            if let Err(e) = state.summary_service.analyze_conversation(session_id).await {
                error!("Failed to generate summary: {}", e);
            }
        },
        
        WsMessage::Ping => {
            // Send pong response
            let connections = ws_manager.connections.read().await;
            if let Some(connection) = connections.get(&connection_id) {
                if let Err(e) = connection.tx.send(WsMessage::Pong) {
                    error!("Failed to send pong: {}", e);
                }
            }
        },
        
        // Server-to-client messages should not be received from client
        _ => {
            warn!("Received unexpected message type from client: {:?}", message);
        }
    }
    
    Ok(())
}