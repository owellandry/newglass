use anyhow::Result;
use std::collections::VecDeque;
use std::time::{Duration, Instant};

/// Audio processor for real-time audio processing
pub struct AudioProcessor {
    sample_rate: u32,
    channels: u16,
    buffer: VecDeque<f32>,
    max_buffer_size: usize,
    last_activity: Option<Instant>,
    silence_threshold: f32,
    noise_gate_threshold: f32,
}

impl AudioProcessor {
    pub fn new(sample_rate: u32, channels: u16) -> Self {
        let max_buffer_duration = Duration::from_secs(30); // 30 seconds max buffer
        let max_buffer_size = (sample_rate as usize * channels as usize) 
            * max_buffer_duration.as_secs() as usize;
        
        Self {
            sample_rate,
            channels,
            buffer: VecDeque::with_capacity(max_buffer_size),
            max_buffer_size,
            last_activity: None,
            silence_threshold: 0.01, // Adjust based on testing
            noise_gate_threshold: 0.005,
        }
    }
    
    /// Process incoming audio samples
    pub fn process_samples(&mut self, samples: &[f32]) -> ProcessedAudio {
        let mut processed_samples = samples.to_vec();
        
        // Apply noise gate
        self.apply_noise_gate(&mut processed_samples);
        
        // Detect voice activity
        let has_voice = self.detect_voice_activity(&processed_samples);
        
        // Update activity timestamp
        if has_voice {
            self.last_activity = Some(Instant::now());
        }
        
        // Add to buffer
        self.add_to_buffer(&processed_samples);
        
        // Calculate audio level
        let level = crate::audio::utils::calculate_rms(&processed_samples);
        
        ProcessedAudio {
            samples: processed_samples,
            has_voice,
            level,
            duration: crate::audio::utils::samples_to_duration(
                samples.len(), 
                self.sample_rate, 
                self.channels
            ),
        }
    }
    
    /// Get buffered audio for transcription
    pub fn get_buffered_audio(&mut self, min_duration: Duration) -> Option<Vec<f32>> {
        let min_samples = (self.sample_rate as f64 * min_duration.as_secs_f64()) as usize 
            * self.channels as usize;
        
        if self.buffer.len() >= min_samples {
            let samples: Vec<f32> = self.buffer.drain(..).collect();
            Some(samples)
        } else {
            None
        }
    }
    
    /// Check if there's been recent voice activity
    pub fn has_recent_activity(&self, timeout: Duration) -> bool {
        if let Some(last_activity) = self.last_activity {
            last_activity.elapsed() < timeout
        } else {
            false
        }
    }
    
    /// Clear the audio buffer
    pub fn clear_buffer(&mut self) {
        self.buffer.clear();
    }
    
    /// Get current buffer duration
    pub fn buffer_duration(&self) -> Duration {
        crate::audio::utils::samples_to_duration(
            self.buffer.len(),
            self.sample_rate,
            self.channels,
        )
    }
    
    fn apply_noise_gate(&self, samples: &mut [f32]) {
        crate::audio::utils::apply_noise_gate(samples, self.noise_gate_threshold, 0.5);
    }
    
    fn detect_voice_activity(&self, samples: &[f32]) -> bool {
        let rms = crate::audio::utils::calculate_rms(samples);
        rms > self.silence_threshold
    }
    
    fn add_to_buffer(&mut self, samples: &[f32]) {
        // Add samples to buffer
        for &sample in samples {
            if self.buffer.len() >= self.max_buffer_size {
                self.buffer.pop_front();
            }
            self.buffer.push_back(sample);
        }
    }
    
    /// Set silence detection threshold
    pub fn set_silence_threshold(&mut self, threshold: f32) {
        self.silence_threshold = threshold.clamp(0.0, 1.0);
    }
    
    /// Set noise gate threshold
    pub fn set_noise_gate_threshold(&mut self, threshold: f32) {
        self.noise_gate_threshold = threshold.clamp(0.0, 1.0);
    }
}

/// Result of audio processing
#[derive(Debug, Clone)]
pub struct ProcessedAudio {
    pub samples: Vec<f32>,
    pub has_voice: bool,
    pub level: f32,
    pub duration: Duration,
}

/// Audio effects processor
pub struct AudioEffects;

impl AudioEffects {
    /// Apply automatic gain control
    pub fn apply_agc(samples: &mut [f32], target_level: f32, max_gain: f32) {
        let current_rms = crate::audio::utils::calculate_rms(samples);
        
        if current_rms > 0.0 {
            let gain = (target_level / current_rms).min(max_gain);
            
            for sample in samples {
                *sample *= gain;
                *sample = sample.clamp(-1.0, 1.0); // Prevent clipping
            }
        }
    }
    
    /// Apply simple high-pass filter to remove low-frequency noise
    pub fn apply_high_pass_filter(samples: &mut [f32], cutoff_freq: f32, sample_rate: u32) {
        // Simple first-order high-pass filter
        let rc = 1.0 / (2.0 * std::f32::consts::PI * cutoff_freq);
        let dt = 1.0 / sample_rate as f32;
        let alpha = rc / (rc + dt);
        
        let mut prev_input = 0.0;
        let mut prev_output = 0.0;
        
        for sample in samples {
            let current_input = *sample;
            let output = alpha * (prev_output + current_input - prev_input);
            
            *sample = output;
            prev_input = current_input;
            prev_output = output;
        }
    }
    
    /// Apply simple low-pass filter to smooth audio
    pub fn apply_low_pass_filter(samples: &mut [f32], cutoff_freq: f32, sample_rate: u32) {
        // Simple first-order low-pass filter
        let rc = 1.0 / (2.0 * std::f32::consts::PI * cutoff_freq);
        let dt = 1.0 / sample_rate as f32;
        let alpha = dt / (rc + dt);
        
        let mut prev_output = 0.0;
        
        for sample in samples {
            let output = prev_output + alpha * (*sample - prev_output);
            *sample = output;
            prev_output = output;
        }
    }
    
    /// Normalize audio to prevent clipping
    pub fn normalize(samples: &mut [f32]) {
        let max_amplitude = samples.iter().map(|&x| x.abs()).fold(0.0f32, f32::max);
        
        if max_amplitude > 1.0 {
            let scale = 1.0 / max_amplitude;
            for sample in samples {
                *sample *= scale;
            }
        }
    }
    
    /// Apply fade in/out to prevent audio pops
    pub fn apply_fade(samples: &mut [f32], fade_in_samples: usize, fade_out_samples: usize) {
        let len = samples.len();
        
        // Fade in
        for (i, sample) in samples.iter_mut().enumerate().take(fade_in_samples.min(len)) {
            let fade_factor = i as f32 / fade_in_samples as f32;
            *sample *= fade_factor;
        }
        
        // Fade out
        let fade_start = len.saturating_sub(fade_out_samples);
        for (i, sample) in samples.iter_mut().enumerate().skip(fade_start) {
            let fade_factor = (len - i) as f32 / fade_out_samples as f32;
            *sample *= fade_factor;
        }
    }
}

/// Audio analysis utilities
pub struct AudioAnalyzer;

impl AudioAnalyzer {
    /// Detect speech segments in audio
    pub fn detect_speech_segments(
        samples: &[f32],
        sample_rate: u32,
        min_speech_duration: Duration,
        min_silence_duration: Duration,
    ) -> Vec<SpeechSegment> {
        let silence_threshold = 0.01;
        let frame_size = (sample_rate as f64 * 0.025) as usize; // 25ms frames
        let hop_size = frame_size / 2;
        
        let mut segments = Vec::new();
        let mut current_segment: Option<SpeechSegment> = None;
        let mut silence_start: Option<usize> = None;
        
        for (frame_idx, frame) in samples.chunks(hop_size).enumerate() {
            let frame_start = frame_idx * hop_size;
            let rms = crate::audio::utils::calculate_rms(frame);
            let is_speech = rms > silence_threshold;
            
            if is_speech {
                if let Some(silence_start_idx) = silence_start {
                    // End of silence
                    if let Some(ref mut segment) = current_segment {
                        let silence_duration = Duration::from_secs_f64(
                            (frame_start - silence_start_idx) as f64 / sample_rate as f64
                        );
                        
                        if silence_duration >= min_silence_duration {
                            // Long silence, end current segment and start new one
                            segments.push(segment.clone());
                            current_segment = Some(SpeechSegment {
                                start_sample: frame_start,
                                end_sample: frame_start + frame.len(),
                                confidence: rms,
                            });
                        } else {
                            // Short silence, extend current segment
                            segment.end_sample = frame_start + frame.len();
                            segment.confidence = (segment.confidence + rms) / 2.0;
                        }
                    }
                    silence_start = None;
                } else if current_segment.is_none() {
                    // Start new segment
                    current_segment = Some(SpeechSegment {
                        start_sample: frame_start,
                        end_sample: frame_start + frame.len(),
                        confidence: rms,
                    });
                } else if let Some(ref mut segment) = current_segment {
                    // Continue current segment
                    segment.end_sample = frame_start + frame.len();
                    segment.confidence = (segment.confidence + rms) / 2.0;
                }
            } else if current_segment.is_some() && silence_start.is_none() {
                // Start of silence
                silence_start = Some(frame_start);
            }
        }
        
        // Add final segment if exists
        if let Some(segment) = current_segment {
            let duration = Duration::from_secs_f64(
                (segment.end_sample - segment.start_sample) as f64 / sample_rate as f64
            );
            
            if duration >= min_speech_duration {
                segments.push(segment);
            }
        }
        
        segments
    }
    
    /// Calculate spectral features for voice activity detection
    pub fn calculate_spectral_features(samples: &[f32]) -> SpectralFeatures {
        let rms = crate::audio::utils::calculate_rms(samples);
        
        // Calculate zero crossing rate
        let mut zero_crossings = 0;
        for window in samples.windows(2) {
            if (window[0] >= 0.0) != (window[1] >= 0.0) {
                zero_crossings += 1;
            }
        }
        let zero_crossing_rate = zero_crossings as f32 / (samples.len() - 1) as f32;
        
        // Calculate spectral centroid (simplified)
        let mut weighted_sum = 0.0;
        let mut magnitude_sum = 0.0;
        
        for (i, &sample) in samples.iter().enumerate() {
            let magnitude = sample.abs();
            weighted_sum += i as f32 * magnitude;
            magnitude_sum += magnitude;
        }
        
        let spectral_centroid = if magnitude_sum > 0.0 {
            weighted_sum / magnitude_sum
        } else {
            0.0
        };
        
        SpectralFeatures {
            rms,
            zero_crossing_rate,
            spectral_centroid,
        }
    }
}

/// Speech segment detected in audio
#[derive(Debug, Clone)]
pub struct SpeechSegment {
    pub start_sample: usize,
    pub end_sample: usize,
    pub confidence: f32,
}

/// Spectral features for audio analysis
#[derive(Debug, Clone)]
pub struct SpectralFeatures {
    pub rms: f32,
    pub zero_crossing_rate: f32,
    pub spectral_centroid: f32,
}