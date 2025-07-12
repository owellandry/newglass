use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AppEvent {
    // Audio events
    AudioCaptured {
        session_id: Uuid,
        audio_data: Vec<u8>,
        speaker: String, // "user" or "system"
    },
    
    // STT events
    TranscriptionReceived {
        session_id: Uuid,
        text: String,
        speaker: String,
        confidence: f32,
    },
    
    // Chat events
    ChatMessageSent {
        session_id: Uuid,
        message: String,
    },
    
    ChatResponseReceived {
        session_id: Uuid,
        response: String,
    },
    
    // Summary events
    SummaryRequested {
        session_id: Uuid,
    },
    
    SummaryGenerated {
        session_id: Uuid,
        summary: String,
    },
    
    // Session events
    SessionStarted {
        session_id: Uuid,
    },
    
    SessionEnded {
        session_id: Uuid,
    },
    
    // Error events
    ErrorOccurred {
        session_id: Option<Uuid>,
        error: String,
        service: String,
    },
    
    // Status events
    StatusUpdate {
        service: String,
        status: ServiceStatus,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ServiceStatus {
    Starting,
    Running,
    Stopping,
    Stopped,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioData {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
    pub channels: u16,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub text: String,
    pub confidence: f32,
    pub speaker: String,
    pub start_time: chrono::DateTime<chrono::Utc>,
    pub end_time: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String, // "user" or "assistant"
    pub content: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummaryData {
    pub tldr: String,
    pub full_summary: String,
    pub action_items: Vec<String>,
    pub key_points: Vec<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}