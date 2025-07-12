use anyhow::Result;
use std::sync::Arc;
use chrono::Utc;
use uuid::Uuid;
use tokio::sync::broadcast;
use tracing::{info, error};

use crate::config::Config;
use crate::services::{
    audio::AudioService,
    stt::SttService,
    chat::ChatService,
    summary::SummaryService,
};
use crate::repositories::{
    session::SessionRepository,
    transcript::TranscriptRepository,
    message::MessageRepository,
    transcript::{Transcript, AudioSource as TranscriptAudioSource},
    message::{Message, MessageRole},
    Repository,
};
use crate::api::ApiServer;
use crate::core::events::AppEvent;

pub struct App {
    config: Config,
    event_tx: broadcast::Sender<AppEvent>,
    
    // Services
    audio_service: Arc<AudioService>,
    stt_service: Arc<SttService>,
    chat_service: Arc<ChatService>,
    summary_service: Arc<SummaryService>,
    
    // Repositories
    session_repo: Arc<SessionRepository>,
    transcript_repo: Arc<TranscriptRepository>,
    message_repo: Arc<MessageRepository>,
    
    // API Server
    api_server: ApiServer,
}

impl App {
    pub async fn new(config: Config) -> Result<Self> {
        // Validate configuration
        config.validate()?;
        
        // Create event channel
        let (event_tx, _) = broadcast::channel(1000);
        
        // Initialize database
        let db_pool = crate::repositories::initialize_database(&config.database.url).await?;
        
        // Initialize repositories
        let session_repo = Arc::new(SessionRepository::new(db_pool.clone()));
        let transcript_repo = Arc::new(TranscriptRepository::new(db_pool.clone()));
        let message_repo = Arc::new(MessageRepository::new(db_pool.clone()));
        
        // Initialize services
        let audio_service = Arc::new(AudioService::new(
            config.audio.clone(),
            event_tx.clone(),
        ).await?);
        
        let stt_service = Arc::new(SttService::new(
            config.openrouter.clone(),
            event_tx.clone(),
        ).await?);
        
        let chat_service = Arc::new(ChatService::new(
            config.openrouter.clone(),
            event_tx.clone(),
        ).await?);
        
        let summary_service = Arc::new(SummaryService::new(
            config.openrouter.clone(),
            event_tx.clone(),
        ).await?);
        
        // Initialize API server
        let api_server = ApiServer::new(
            db_pool,
            session_repo.clone(),
            transcript_repo.clone(),
            message_repo.clone(),
            audio_service.clone(),
            stt_service.clone(),
            chat_service.clone(),
            summary_service.clone(),
            event_tx.clone(),
            config.server.clone(),
        );
        
        Ok(Self {
            config,
            event_tx,
            audio_service,
            stt_service,
            chat_service,
            summary_service,
            session_repo,
            transcript_repo,
            message_repo,
            api_server,
        })
    }
    
    pub async fn run(self) -> Result<()> {
        info!("Starting NewGlass application...");
        
        // Start event loop
        let event_loop = self.start_event_loop();
        
        // Start API server
        let server = self.api_server.run();
        
        // Start audio service
        let audio = self.audio_service.start();
        
        // Wait for all services
        tokio::select! {
            result = event_loop => {
                error!("Event loop ended: {:?}", result);
                result
            },
            result = server => {
                error!("API server ended: {:?}", result);
                result
            },
            result = audio => {
                error!("Audio service ended: {:?}", result);
                result
            },
        }
    }
    
    async fn start_event_loop(&self) -> Result<()> {
        let mut event_rx = self.event_tx.subscribe();
        
        info!("Event loop started");
        
        while let Ok(event) = event_rx.recv().await {
            if let Err(e) = self.handle_event(event).await {
                error!("Error handling event: {}", e);
            }
        }
        
        Ok(())
    }
    
    async fn handle_event(&self, event: AppEvent) -> Result<()> {
        match event {
            AppEvent::AudioCaptured { session_id, audio_data, speaker } => {
                // Send audio to STT service
                self.stt_service.process_audio(session_id, audio_data, speaker).await?;
            },
            AppEvent::TranscriptionReceived { session_id, text, speaker, confidence } => {
                let audio_source = match speaker.as_str() {
                    "system" => TranscriptAudioSource::System,
                    _ => TranscriptAudioSource::User,
                };
                let transcript = Transcript {
                    id: Uuid::new_v4(),
                    session_id,
                    speaker: speaker.clone(),
                    text: text.clone(),
                    confidence: Some(confidence),
                    audio_source,
                    language: None,
                    created_at: Utc::now(),
                    audio_duration: None,
                    word_count: None,
                };
                self.transcript_repo.create(&transcript).await?;
                
                // Send to summary service for analysis
                self.summary_service.add_conversation_turn(session_id, speaker, text).await?;
            },
            AppEvent::ChatMessageSent { session_id, message } => {
                // Process chat message
                let response = self.chat_service.process_message(session_id, message.clone()).await?;

                // Save both message and response
                let user_msg = Message {
                    id: Uuid::new_v4(),
                    session_id,
                    role: MessageRole::User,
                    content: message,
                    model: None,
                    tokens_used: None,
                    response_time: None,
                    created_at: Utc::now(),
                    metadata: None,
                    parent_message_id: None,
                    is_edited: false,
                    edit_count: 0,
                };
                self.message_repo.create(&user_msg).await?;

                let assistant_msg = Message {
                    id: Uuid::new_v4(),
                    session_id,
                    role: MessageRole::Assistant,
                    content: response,
                    model: None,
                    tokens_used: None,
                    response_time: None,
                    created_at: Utc::now(),
                    metadata: None,
                    parent_message_id: None,
                    is_edited: false,
                    edit_count: 0,
                };
                self.message_repo.create(&assistant_msg).await?;
            },
            AppEvent::SummaryGenerated { session_id, summary } => {
                // Save summary to database
                info!("Summary generated for session {}: {}", session_id, summary);
            },
            AppEvent::SessionStarted { session_id } => {
                info!("Session started: {}", session_id);
            },
            AppEvent::SessionEnded { session_id } => {
                info!("Session ended: {}", session_id);
            },
            _ => {}
        }
        
        Ok(())
    }
}