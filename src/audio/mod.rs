pub mod processing;
pub mod formats;
pub mod utils;

use anyhow::Result;
use std::time::Duration;

pub use processing::*;
pub use formats::*;

/// Audio configuration constants
pub const SAMPLE_RATE: u32 = 44100;
pub const CHANNELS: u16 = 2;
pub const BITS_PER_SAMPLE: u16 = 16;
pub const BUFFER_SIZE: usize = 4096;

/// Audio quality settings
#[derive(Debug, Clone)]
pub enum AudioQuality {
    Low,    // 22kHz, mono
    Medium, // 44kHz, mono
    High,   // 44kHz, stereo
}

impl AudioQuality {
    pub fn sample_rate(&self) -> u32 {
        match self {
            AudioQuality::Low => 22050,
            AudioQuality::Medium | AudioQuality::High => 44100,
        }
    }
    
    pub fn channels(&self) -> u16 {
        match self {
            AudioQuality::Low | AudioQuality::Medium => 1,
            AudioQuality::High => 2,
        }
    }
}

/// Audio device information
#[derive(Debug, Clone)]
pub struct AudioDevice {
    pub name: String,
    pub is_default: bool,
    pub max_input_channels: u32,
    pub max_output_channels: u32,
    pub default_sample_rate: u32,
}

/// Audio stream configuration
#[derive(Debug, Clone)]
pub struct AudioConfig {
    pub sample_rate: u32,
    pub channels: u16,
    pub buffer_duration: Duration,
    pub quality: AudioQuality,
}

impl Default for AudioConfig {
    fn default() -> Self {
        Self {
            sample_rate: SAMPLE_RATE,
            channels: CHANNELS,
            buffer_duration: Duration::from_millis(100),
            quality: AudioQuality::Medium,
        }
    }
}

/// Get available audio devices
pub fn get_audio_devices() -> Result<Vec<AudioDevice>> {
    use cpal::traits::{DeviceTrait, HostTrait};
    
    let host = cpal::default_host();
    let mut devices = Vec::new();
    
    // Input devices
    for device in host.input_devices()? {
        let name = device.name().unwrap_or_else(|_| "Unknown Device".to_string());
        let default_config = device.default_input_config().ok();
        
        devices.push(AudioDevice {
            name,
            is_default: false, // We'll set this separately
            max_input_channels: default_config.as_ref().map(|c| c.channels() as u32).unwrap_or(0),
            max_output_channels: 0,
            default_sample_rate: default_config.as_ref().map(|c| c.sample_rate().0).unwrap_or(44100),
        });
    }
    
    // Mark default device
    if let Ok(default_device) = host.default_input_device() {
        if let Ok(default_name) = default_device.name() {
            for device in &mut devices {
                if device.name == default_name {
                    device.is_default = true;
                    break;
                }
            }
        }
    }
    
    Ok(devices)
}

/// Audio utility functions
pub mod utils {
    use super::*;
    
    /// Convert audio samples to bytes
    pub fn samples_to_bytes(samples: &[f32]) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(samples.len() * 2);
        
        for &sample in samples {
            // Convert f32 to i16
            let sample_i16 = (sample * i16::MAX as f32) as i16;
            bytes.extend_from_slice(&sample_i16.to_le_bytes());
        }
        
        bytes
    }
    
    /// Convert bytes to audio samples
    pub fn bytes_to_samples(bytes: &[u8]) -> Vec<f32> {
        let mut samples = Vec::with_capacity(bytes.len() / 2);
        
        for chunk in bytes.chunks_exact(2) {
            let sample_i16 = i16::from_le_bytes([chunk[0], chunk[1]]);
            let sample_f32 = sample_i16 as f32 / i16::MAX as f32;
            samples.push(sample_f32);
        }
        
        samples
    }
    
    /// Calculate audio duration from sample count
    pub fn samples_to_duration(sample_count: usize, sample_rate: u32, channels: u16) -> Duration {
        let frames = sample_count / channels as usize;
        let seconds = frames as f64 / sample_rate as f64;
        Duration::from_secs_f64(seconds)
    }
    
    /// Calculate RMS (Root Mean Square) for audio level detection
    pub fn calculate_rms(samples: &[f32]) -> f32 {
        if samples.is_empty() {
            return 0.0;
        }
        
        let sum_of_squares: f32 = samples.iter().map(|&x| x * x).sum();
        (sum_of_squares / samples.len() as f32).sqrt()
    }
    
    /// Detect silence in audio samples
    pub fn is_silence(samples: &[f32], threshold: f32) -> bool {
        calculate_rms(samples) < threshold
    }
    
    /// Apply simple noise gate
    pub fn apply_noise_gate(samples: &mut [f32], threshold: f32) {
        for sample in samples {
            if sample.abs() < threshold {
                *sample = 0.0;
            }
        }
    }
}