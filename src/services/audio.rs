use anyhow::Result;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, Host, Stream, StreamConfig};
use std::sync::Arc;
use tokio::sync::{broadcast, mpsc, RwLock};
use tracing::{info, warn, error};
use uuid::Uuid;

use crate::config::AudioConfig;
use crate::core::events::AppEvent;

pub struct AudioService {
    config: AudioConfig,
    event_tx: broadcast::Sender<AppEvent>,
    
    // Audio streams
    microphone_stream: Arc<RwLock<Option<Stream>>>,
    system_audio_stream: Arc<RwLock<Option<Stream>>>,
    
    // Current session
    current_session: Arc<RwLock<Option<Uuid>>>,
    
    // Audio processing
    audio_tx: mpsc::Sender<AudioData>,
    audio_rx: Arc<RwLock<Option<mpsc::Receiver<AudioData>>>>,
}

#[derive(Debug, Clone)]
struct AudioData {
    session_id: Uuid,
    samples: Vec<f32>,
    speaker: String,
    timestamp: chrono::DateTime<chrono::Utc>,
}

impl AudioService {
    pub async fn new(
        config: AudioConfig,
        event_tx: broadcast::Sender<AppEvent>,
    ) -> Result<Self> {
        let (audio_tx, audio_rx) = mpsc::channel(1000);
        
        Ok(Self {
            config,
            event_tx,
            microphone_stream: Arc::new(RwLock::new(None)),
            system_audio_stream: Arc::new(RwLock::new(None)),
            current_session: Arc::new(RwLock::new(None)),
            audio_tx,
            audio_rx: Arc::new(RwLock::new(Some(audio_rx))),
        })
    }
    
    pub async fn start(&self) -> Result<()> {
        info!("Starting audio service...");
        
        // Start audio processing loop
        let mut audio_rx = self.audio_rx.write().await.take()
            .ok_or_else(|| anyhow::anyhow!("Audio receiver already taken"))?;
        
        let event_tx = self.event_tx.clone();
        
        tokio::spawn(async move {
            while let Some(audio_data) = audio_rx.recv().await {
                // Convert audio samples to bytes for transmission
                let audio_bytes = Self::samples_to_bytes(&audio_data.samples);
                
                let event = AppEvent::AudioCaptured {
                    session_id: audio_data.session_id,
                    audio_data: audio_bytes,
                    speaker: audio_data.speaker,
                };
                
                if let Err(e) = event_tx.send(event) {
                    error!("Failed to send audio event: {}", e);
                }
            }
        });
        
        info!("Audio service started successfully");
        Ok(())
    }
    
    pub async fn start_recording(&self, session_id: Uuid) -> Result<()> {
        info!("Starting audio recording for session: {}", session_id);
        
        // Set current session
        *self.current_session.write().await = Some(session_id);
        
        // Start microphone recording
        self.start_microphone_recording(session_id).await?;
        
        // Start system audio recording
        self.start_system_audio_recording(session_id).await?;
        
        Ok(())
    }
    
    pub async fn stop_recording(&self) -> Result<()> {
        info!("Stopping audio recording");
        
        // Stop streams
        if let Some(stream) = self.microphone_stream.write().await.take() {
            drop(stream);
        }
        
        if let Some(stream) = self.system_audio_stream.write().await.take() {
            drop(stream);
        }
        
        // Clear current session
        *self.current_session.write().await = None;
        
        Ok(())
    }
    
    async fn start_microphone_recording(&self, session_id: Uuid) -> Result<()> {
        let host = cpal::default_host();
        let device = host.default_input_device()
            .ok_or_else(|| anyhow::anyhow!("No input device available"))?;
        
        let config = self.get_stream_config(&device)?;
        let audio_tx = self.audio_tx.clone();
        
        let stream = device.build_input_stream(
            &config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                let audio_data = AudioData {
                    session_id,
                    samples: data.to_vec(),
                    speaker: "user".to_string(),
                    timestamp: chrono::Utc::now(),
                };
                
                if let Err(e) = audio_tx.try_send(audio_data) {
                    warn!("Failed to send microphone audio data: {}", e);
                }
            },
            |err| error!("Microphone stream error: {}", err),
            None,
        )?;
        
        stream.play()?;
        *self.microphone_stream.write().await = Some(stream);
        
        info!("Microphone recording started");
        Ok(())
    }
    
    async fn start_system_audio_recording(&self, session_id: Uuid) -> Result<()> {
        // Note: System audio capture is platform-specific and complex
        // This is a simplified implementation
        warn!("System audio recording not fully implemented yet");
        
        // For now, we'll just log that it would start
        info!("System audio recording would start for session: {}", session_id);
        
        Ok(())
    }
    
    fn get_stream_config(&self, device: &Device) -> Result<StreamConfig> {
        let supported_configs = device.supported_input_configs()?;
        
        // Try to find a config that matches our requirements
        for supported_config in supported_configs {
            if supported_config.channels() == self.config.channels
                && supported_config.min_sample_rate().0 <= self.config.sample_rate
                && supported_config.max_sample_rate().0 >= self.config.sample_rate
            {
                return Ok(StreamConfig {
                    channels: self.config.channels,
                    sample_rate: cpal::SampleRate(self.config.sample_rate),
                    buffer_size: cpal::BufferSize::Fixed(self.config.buffer_size as u32),
                });
            }
        }
        
        // Fallback to default config
        Ok(device.default_input_config()?.into())
    }
    
    fn samples_to_bytes(samples: &[f32]) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(samples.len() * 4);
        for sample in samples {
            bytes.extend_from_slice(&sample.to_le_bytes());
        }
        bytes
    }
    
    pub async fn is_recording(&self) -> bool {
        self.current_session.read().await.is_some()
    }
    
    pub async fn get_current_session(&self) -> Option<Uuid> {
        *self.current_session.read().await
    }
}