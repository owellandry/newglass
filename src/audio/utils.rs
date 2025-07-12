use std::time::Duration;

/// Convert f32 audio samples to bytes (little-endian i16)
pub fn samples_to_bytes(samples: &[f32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(samples.len() * 2);
    
    for &sample in samples {
        // Clamp to [-1.0, 1.0] and convert to i16
        let clamped = sample.clamp(-1.0, 1.0);
        let i16_sample = (clamped * i16::MAX as f32) as i16;
        bytes.extend_from_slice(&i16_sample.to_le_bytes());
    }
    
    bytes
}

/// Convert bytes (little-endian i16) to f32 audio samples
pub fn bytes_to_samples(bytes: &[u8]) -> Vec<f32> {
    let mut samples = Vec::with_capacity(bytes.len() / 2);
    
    for chunk in bytes.chunks_exact(2) {
        let i16_sample = i16::from_le_bytes([chunk[0], chunk[1]]);
        let f32_sample = i16_sample as f32 / i16::MAX as f32;
        samples.push(f32_sample);
    }
    
    samples
}

/// Calculate the duration of audio samples
pub fn calculate_duration(sample_count: usize, sample_rate: u32, channels: u16) -> Duration {
    let frames = sample_count / channels as usize;
    let seconds = frames as f64 / sample_rate as f64;
    Duration::from_secs_f64(seconds)
}

/// Calculate RMS (Root Mean Square) of audio samples
pub fn calculate_rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    
    let sum_squares: f32 = samples.iter().map(|&s| s * s).sum();
    (sum_squares / samples.len() as f32).sqrt()
}

/// Calculate peak amplitude of audio samples
pub fn calculate_peak(samples: &[f32]) -> f32 {
    samples.iter().map(|&s| s.abs()).fold(0.0, f32::max)
}

/// Detect silence in audio samples
pub fn detect_silence(samples: &[f32], threshold: f32) -> bool {
    calculate_rms(samples) < threshold
}

/// Apply a simple noise gate to audio samples
pub fn apply_noise_gate(samples: &mut [f32], threshold: f32, ratio: f32) {
    for sample in samples.iter_mut() {
        let amplitude = sample.abs();
        if amplitude < threshold {
            *sample *= ratio;
        }
    }
}

/// Normalize audio samples to a target peak level
pub fn normalize_audio(samples: &mut [f32], target_peak: f32) {
    let current_peak = calculate_peak(samples);
    if current_peak > 0.0 {
        let gain = target_peak / current_peak;
        for sample in samples.iter_mut() {
            *sample *= gain;
        }
    }
}

/// Apply a simple high-pass filter (removes DC offset and low frequencies)
pub fn apply_high_pass_filter(samples: &mut [f32], cutoff_ratio: f32) {
    if samples.is_empty() {
        return;
    }
    
    let alpha = cutoff_ratio.clamp(0.0, 1.0);
    let mut prev_input = samples[0];
    let mut prev_output = 0.0;
    
    for sample in samples.iter_mut() {
        let input = *sample;
        let output = alpha * (prev_output + input - prev_input);
        *sample = output;
        prev_input = input;
        prev_output = output;
    }
}

/// Apply a simple low-pass filter (smooths audio, removes high frequencies)
pub fn apply_low_pass_filter(samples: &mut [f32], cutoff_ratio: f32) {
    if samples.is_empty() {
        return;
    }
    
    let alpha = cutoff_ratio.clamp(0.0, 1.0);
    let mut prev_output = samples[0];
    
    for sample in samples.iter_mut() {
        let output = alpha * *sample + (1.0 - alpha) * prev_output;
        *sample = output;
        prev_output = output;
    }
}

/// Apply automatic gain control (AGC)
pub fn apply_agc(samples: &mut [f32], target_rms: f32, attack: f32, release: f32) {
    if samples.is_empty() {
        return;
    }
    
    let mut gain = 1.0;
    let chunk_size = 1024.min(samples.len());
    
    for chunk in samples.chunks_mut(chunk_size) {
        let current_rms = calculate_rms(chunk);
        
        if current_rms > 0.0 {
            let target_gain = target_rms / current_rms;
            
            // Smooth gain changes
            if target_gain > gain {
                gain += (target_gain - gain) * attack;
            } else {
                gain += (target_gain - gain) * release;
            }
            
            // Apply gain to chunk
            for sample in chunk.iter_mut() {
                *sample *= gain;
            }
        }
    }
}

/// Apply fade in effect
pub fn apply_fade_in(samples: &mut [f32], fade_samples: usize) {
    let fade_length = fade_samples.min(samples.len());
    
    for (i, sample) in samples.iter_mut().take(fade_length).enumerate() {
        let gain = i as f32 / fade_length as f32;
        *sample *= gain;
    }
}

/// Apply fade out effect
pub fn apply_fade_out(samples: &mut [f32], fade_samples: usize) {
    let fade_length = fade_samples.min(samples.len());
    let start_idx = samples.len().saturating_sub(fade_length);
    
    for (i, sample) in samples.iter_mut().skip(start_idx).enumerate() {
        let gain = 1.0 - (i as f32 / fade_length as f32);
        *sample *= gain;
    }
}

/// Mix two audio streams together
pub fn mix_audio(samples1: &[f32], samples2: &[f32], mix_ratio: f32) -> Vec<f32> {
    let max_len = samples1.len().max(samples2.len());
    let mut result = Vec::with_capacity(max_len);
    
    for i in 0..max_len {
        let sample1 = samples1.get(i).copied().unwrap_or(0.0);
        let sample2 = samples2.get(i).copied().unwrap_or(0.0);
        
        let mixed = sample1 * (1.0 - mix_ratio) + sample2 * mix_ratio;
        result.push(mixed);
    }
    
    result
}

/// Detect voice activity using simple energy-based detection
pub fn detect_voice_activity(
    samples: &[f32],
    energy_threshold: f32,
    zero_crossing_threshold: f32,
) -> bool {
    if samples.is_empty() {
        return false;
    }
    
    // Calculate energy (RMS)
    let energy = calculate_rms(samples);
    
    // Calculate zero crossing rate
    let mut zero_crossings = 0;
    for window in samples.windows(2) {
        if (window[0] >= 0.0) != (window[1] >= 0.0) {
            zero_crossings += 1;
        }
    }
    let zero_crossing_rate = zero_crossings as f32 / (samples.len() - 1) as f32;
    
    energy > energy_threshold && zero_crossing_rate > zero_crossing_threshold
}

/// Calculate spectral centroid (brightness measure)
pub fn calculate_spectral_centroid(samples: &[f32], sample_rate: u32) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    
    // Simple approximation using zero crossing rate
    let mut zero_crossings = 0;
    for window in samples.windows(2) {
        if (window[0] >= 0.0) != (window[1] >= 0.0) {
            zero_crossings += 1;
        }
    }
    
    // Estimate fundamental frequency from zero crossings
    let estimated_freq = (zero_crossings as f32 * sample_rate as f32) / (2.0 * samples.len() as f32);
    estimated_freq
}

/// Split stereo samples into left and right channels
pub fn split_stereo(samples: &[f32]) -> (Vec<f32>, Vec<f32>) {
    let mut left = Vec::with_capacity(samples.len() / 2);
    let mut right = Vec::with_capacity(samples.len() / 2);
    
    for chunk in samples.chunks_exact(2) {
        left.push(chunk[0]);
        right.push(chunk[1]);
    }
    
    (left, right)
}

/// Combine left and right channels into stereo samples
pub fn combine_stereo(left: &[f32], right: &[f32]) -> Vec<f32> {
    let max_len = left.len().max(right.len());
    let mut result = Vec::with_capacity(max_len * 2);
    
    for i in 0..max_len {
        let l = left.get(i).copied().unwrap_or(0.0);
        let r = right.get(i).copied().unwrap_or(0.0);
        result.push(l);
        result.push(r);
    }
    
    result
}

/// Convert mono samples to stereo by duplicating the channel
pub fn mono_to_stereo(samples: &[f32]) -> Vec<f32> {
    let mut result = Vec::with_capacity(samples.len() * 2);
    
    for &sample in samples {
        result.push(sample);
        result.push(sample);
    }
    
    result
}

/// Convert stereo samples to mono by averaging channels
pub fn stereo_to_mono(samples: &[f32]) -> Vec<f32> {
    let mut result = Vec::with_capacity(samples.len() / 2);
    
    for chunk in samples.chunks_exact(2) {
        let mono_sample = (chunk[0] + chunk[1]) / 2.0;
        result.push(mono_sample);
    }
    
    result
}

/// Generate silence samples
pub fn generate_silence(duration: Duration, sample_rate: u32, channels: u16) -> Vec<f32> {
    let sample_count = (duration.as_secs_f64() * sample_rate as f64) as usize * channels as usize;
    vec![0.0; sample_count]
}

/// Generate a sine wave tone
pub fn generate_sine_wave(
    frequency: f32,
    duration: Duration,
    sample_rate: u32,
    amplitude: f32,
    channels: u16,
) -> Vec<f32> {
    let frame_count = (duration.as_secs_f64() * sample_rate as f64) as usize;
    let mut samples = Vec::with_capacity(frame_count * channels as usize);
    
    for frame in 0..frame_count {
        let t = frame as f32 / sample_rate as f32;
        let sample = amplitude * (2.0 * std::f32::consts::PI * frequency * t).sin();
        
        for _ in 0..channels {
            samples.push(sample);
        }
    }
    
    samples
}

/// Audio buffer utilities
pub mod buffer {
    use std::collections::VecDeque;
    
    /// Circular audio buffer for streaming applications
    pub struct CircularBuffer {
        buffer: VecDeque<f32>,
        capacity: usize,
    }
    
    impl CircularBuffer {
        pub fn new(capacity: usize) -> Self {
            Self {
                buffer: VecDeque::with_capacity(capacity),
                capacity,
            }
        }
        
        pub fn push(&mut self, sample: f32) {
            if self.buffer.len() >= self.capacity {
                self.buffer.pop_front();
            }
            self.buffer.push_back(sample);
        }
        
        pub fn push_samples(&mut self, samples: &[f32]) {
            for &sample in samples {
                self.push(sample);
            }
        }
        
        pub fn get_samples(&self) -> Vec<f32> {
            self.buffer.iter().copied().collect()
        }
        
        pub fn len(&self) -> usize {
            self.buffer.len()
        }
        
        pub fn is_empty(&self) -> bool {
            self.buffer.is_empty()
        }
        
        pub fn clear(&mut self) {
            self.buffer.clear();
        }
        
        pub fn capacity(&self) -> usize {
            self.capacity
        }
        
        pub fn is_full(&self) -> bool {
            self.buffer.len() >= self.capacity
        }
    }
    
    /// Ring buffer for low-latency audio processing
    pub struct RingBuffer {
        buffer: Vec<f32>,
        write_pos: usize,
        read_pos: usize,
        size: usize,
    }
    
    impl RingBuffer {
        pub fn new(size: usize) -> Self {
            Self {
                buffer: vec![0.0; size],
                write_pos: 0,
                read_pos: 0,
                size,
            }
        }
        
        pub fn write(&mut self, samples: &[f32]) -> usize {
            let mut written = 0;
            
            for &sample in samples {
                if self.available_write() > 0 {
                    self.buffer[self.write_pos] = sample;
                    self.write_pos = (self.write_pos + 1) % self.size;
                    written += 1;
                } else {
                    break;
                }
            }
            
            written
        }
        
        pub fn read(&mut self, output: &mut [f32]) -> usize {
            let mut read = 0;
            
            for sample in output.iter_mut() {
                if self.available_read() > 0 {
                    *sample = self.buffer[self.read_pos];
                    self.read_pos = (self.read_pos + 1) % self.size;
                    read += 1;
                } else {
                    *sample = 0.0;
                }
            }
            
            read
        }
        
        pub fn available_read(&self) -> usize {
            if self.write_pos >= self.read_pos {
                self.write_pos - self.read_pos
            } else {
                self.size - self.read_pos + self.write_pos
            }
        }
        
        pub fn available_write(&self) -> usize {
            self.size - self.available_read() - 1
        }
        
        pub fn clear(&mut self) {
            self.read_pos = 0;
            self.write_pos = 0;
            self.buffer.fill(0.0);
        }
    }
}