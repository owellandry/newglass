use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tracing::{info, error, warn};
use uuid::Uuid;

use crate::config::OpenRouterConfig;
use crate::core::events::AppEvent;
use crate::services::openrouter::OpenRouterClient;

pub struct SttService {
    client: OpenRouterClient,
    event_tx: broadcast::Sender<AppEvent>,
    
    // Audio buffers for each session
    audio_buffers: Arc<RwLock<HashMap<Uuid, AudioBuffer>>>,
    
    // Processing state
    processing_sessions: Arc<RwLock<HashMap<Uuid, bool>>>,
}

#[derive(Debug)]
struct AudioBuffer {
    user_audio: Vec<u8>,
    system_audio: Vec<u8>,
    last_processed: chrono::DateTime<chrono::Utc>,
    buffer_duration_ms: u64,
}

const BUFFER_DURATION_MS: u64 = 3000; // 3 seconds
const MIN_AUDIO_LENGTH: usize = 1024; // Minimum audio length to process

impl AudioBuffer {
    fn new() -> Self {
        Self {
            user_audio: Vec::new(),
            system_audio: Vec::new(),
            last_processed: chrono::Utc::now(),
            buffer_duration_ms: BUFFER_DURATION_MS,
        }
    }
    
    fn add_audio(&mut self, audio_data: Vec<u8>, speaker: &str) {
        match speaker {
            "user" => self.user_audio.extend(audio_data),
            "system" => self.system_audio.extend(audio_data),
            _ => warn!("Unknown speaker type: {}", speaker),
        }
    }
    
    fn should_process(&self) -> bool {
        let now = chrono::Utc::now();
        let elapsed = now.signed_duration_since(self.last_processed);
        
        elapsed.num_milliseconds() >= self.buffer_duration_ms as i64
            && (self.user_audio.len() >= MIN_AUDIO_LENGTH || self.system_audio.len() >= MIN_AUDIO_LENGTH)
    }
    
    fn extract_audio(&mut self, speaker: &str) -> Option<Vec<u8>> {
        match speaker {
            "user" => {
                if self.user_audio.len() >= MIN_AUDIO_LENGTH {
                    let audio = self.user_audio.clone();
                    self.user_audio.clear();
                    Some(audio)
                } else {
                    None
                }
            },
            "system" => {
                if self.system_audio.len() >= MIN_AUDIO_LENGTH {
                    let audio = self.system_audio.clone();
                    self.system_audio.clear();
                    Some(audio)
                } else {
                    None
                }
            },
            _ => None,
        }
    }
    
    fn update_last_processed(&mut self) {
        self.last_processed = chrono::Utc::now();
    }
}

impl SttService {
    pub async fn new(
        config: OpenRouterConfig,
        event_tx: broadcast::Sender<AppEvent>,
    ) -> Result<Self> {
        let client = OpenRouterClient::new(config)?;
        
        Ok(Self {
            client,
            event_tx,
            audio_buffers: Arc::new(RwLock::new(HashMap::new())),
            processing_sessions: Arc::new(RwLock::new(HashMap::new())),
        })
    }
    
    pub async fn process_audio(
        &self,
        session_id: Uuid,
        audio_data: Vec<u8>,
        speaker: String,
    ) -> Result<()> {
        // Add audio to buffer
        {
            let mut buffers = self.audio_buffers.write().await;
            let buffer = buffers.entry(session_id).or_insert_with(AudioBuffer::new);
            buffer.add_audio(audio_data, &speaker);
        }
        
        // Check if we should process the buffer
        let should_process = {
            let buffers = self.audio_buffers.read().await;
            buffers.get(&session_id)
                .map(|b| b.should_process())
                .unwrap_or(false)
        };
        
        if should_process {
            self.process_buffered_audio(session_id).await?;
        }
        
        Ok(())
    }
    
    async fn process_buffered_audio(&self, session_id: Uuid) -> Result<()> {
        // Check if already processing this session
        {
            let processing = self.processing_sessions.read().await;
            if processing.get(&session_id).copied().unwrap_or(false) {
                return Ok(()); // Already processing
            }
        }
        
        // Mark as processing
        {
            let mut processing = self.processing_sessions.write().await;
            processing.insert(session_id, true);
        }
        
        // Extract audio data
        let (user_audio, system_audio) = {
            let mut buffers = self.audio_buffers.write().await;
            if let Some(buffer) = buffers.get_mut(&session_id) {
                let user_audio = buffer.extract_audio("user");
                let system_audio = buffer.extract_audio("system");
                buffer.update_last_processed();
                (user_audio, system_audio)
            } else {
                (None, None)
            }
        };
        
        // Process user audio
        if let Some(audio) = user_audio {
            self.transcribe_audio(session_id, audio, "user".to_string()).await?;
        }
        
        // Process system audio
        if let Some(audio) = system_audio {
            self.transcribe_audio(session_id, audio, "system".to_string()).await?;
        }
        
        // Mark as not processing
        {
            let mut processing = self.processing_sessions.write().await;
            processing.insert(session_id, false);
        }
        
        Ok(())
    }
    
    async fn transcribe_audio(
        &self,
        session_id: Uuid,
        audio_data: Vec<u8>,
        speaker: String,
    ) -> Result<()> {
        info!(
            "Transcribing audio for session {} (speaker: {}, {} bytes)",
            session_id,
            speaker,
            audio_data.len()
        );
        
        match self.client.transcribe_audio(&audio_data, Some("en")).await {
            Ok(text) => {
                let text = text.trim();
                if !text.is_empty() {
                    info!(
                        "Transcription result for {} (session {}): {}",
                        speaker, session_id, text
                    );
                    
                    let event = AppEvent::TranscriptionReceived {
                        session_id,
                        text: text.to_string(),
                        speaker,
                        confidence: 0.9, // OpenRouter doesn't provide confidence, so we use a default
                    };
                    
                    if let Err(e) = self.event_tx.send(event) {
                        error!("Failed to send transcription event: {}", e);
                    }
                } else {
                    info!("Empty transcription result for {} (session {})", speaker, session_id);
                }
            },
            Err(e) => {
                error!(
                    "Transcription failed for {} (session {}): {}",
                    speaker, session_id, e
                );
                
                let event = AppEvent::ErrorOccurred {
                    session_id: Some(session_id),
                    error: format!("STT error: {}", e),
                    service: "stt".to_string(),
                };
                
                if let Err(e) = self.event_tx.send(event) {
                    error!("Failed to send error event: {}", e);
                }
            }
        }
        
        Ok(())
    }
    
    pub async fn start_session(&self, session_id: Uuid) -> Result<()> {
        info!("Starting STT session: {}", session_id);
        
        // Initialize buffer for this session
        {
            let mut buffers = self.audio_buffers.write().await;
            buffers.insert(session_id, AudioBuffer::new());
        }
        
        // Initialize processing state
        {
            let mut processing = self.processing_sessions.write().await;
            processing.insert(session_id, false);
        }
        
        Ok(())
    }
    
    pub async fn end_session(&self, session_id: Uuid) -> Result<()> {
        info!("Ending STT session: {}", session_id);
        
        // Process any remaining audio
        self.process_buffered_audio(session_id).await?;
        
        // Clean up buffers
        {
            let mut buffers = self.audio_buffers.write().await;
            buffers.remove(&session_id);
        }
        
        // Clean up processing state
        {
            let mut processing = self.processing_sessions.write().await;
            processing.remove(&session_id);
        }
        
        Ok(())
    }
    
    pub async fn force_process_session(&self, session_id: Uuid) -> Result<()> {
        info!("Force processing STT session: {}", session_id);
        self.process_buffered_audio(session_id).await
    }
    
    pub async fn get_active_sessions(&self) -> Vec<Uuid> {
        let buffers = self.audio_buffers.read().await;
        buffers.keys().copied().collect()
    }
}