use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;
use std::env;

/// Main application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub database: DatabaseConfig,
    pub audio: AudioConfig,
    pub openrouter: OpenRouterConfig,
    pub server: ServerConfig,
    pub logging: LoggingConfig,
    pub session: SessionConfig,
    pub transcription: TranscriptionConfig,
    pub chat: ChatConfig,
    pub summary: SummaryConfig,
}

/// Database configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
    pub connection_timeout: u64,
    pub auto_migrate: bool,
}

/// Audio configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioConfig {
    pub sample_rate: u32,
    pub channels: u16,
    pub buffer_size: usize,
    pub input_device: Option<String>,
    pub output_device: Option<String>,
    pub noise_gate_threshold: f32,
    pub voice_activity_threshold: f32,
    pub auto_gain_control: bool,
    pub echo_cancellation: bool,
}

/// OpenRouter API configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenRouterConfig {
    pub api_key: String,
    pub base_url: String,
    pub chat_model: String,
    pub transcription_model: String,
    pub max_tokens: u32,
    pub temperature: f32,
    pub timeout: u64,
    pub retry_attempts: u32,
    pub retry_delay: u64,
}

/// Server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub cors_origins: Vec<String>,
    pub max_request_size: usize,
    pub request_timeout: u64,
    pub websocket_ping_interval: u64,
    pub rate_limit_requests: u32,
    pub rate_limit_window: u64,
}

/// Logging configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub level: String,
    pub file_path: Option<PathBuf>,
    pub max_file_size: u64,
    pub max_files: u32,
    pub console_output: bool,
    pub json_format: bool,
}

/// Session management configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConfig {
    pub default_timeout: u64,
    pub max_sessions_per_user: u32,
    pub cleanup_interval: u64,
    pub auto_save_interval: u64,
    pub session_history_limit: u32,
}

/// Transcription configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionConfig {
    pub buffer_duration: u64,
    pub min_audio_length: u64,
    pub silence_threshold: f32,
    pub language: Option<String>,
    pub auto_detect_language: bool,
    pub enable_timestamps: bool,
    pub enable_word_timestamps: bool,
}

/// Chat configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatConfig {
    pub max_history_length: u32,
    pub context_window: u32,
    pub system_prompt: Option<String>,
    pub enable_streaming: bool,
    pub response_timeout: u64,
    pub auto_summarize_threshold: u32,
}

/// Summary configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummaryConfig {
    pub auto_generate: bool,
    pub trigger_threshold: u32,
    pub analysis_interval: u64,
    pub max_summary_length: u32,
    pub include_sentiment: bool,
    pub include_topics: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            database: DatabaseConfig::default(),
            audio: AudioConfig::default(),
            openrouter: OpenRouterConfig::default(),
            server: ServerConfig::default(),
            logging: LoggingConfig::default(),
            session: SessionConfig::default(),
            transcription: TranscriptionConfig::default(),
            chat: ChatConfig::default(),
            summary: SummaryConfig::default(),
        }
    }
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            url: "sqlite:./data/newglass.db".to_string(),
            max_connections: 10,
            connection_timeout: 30,
            auto_migrate: true,
        }
    }
}

impl Default for AudioConfig {
    fn default() -> Self {
        Self {
            sample_rate: 44100,
            channels: 2,
            buffer_size: 1024,
            input_device: None,
            output_device: None,
            noise_gate_threshold: 0.01,
            voice_activity_threshold: 0.02,
            auto_gain_control: true,
            echo_cancellation: true,
        }
    }
}

impl Default for OpenRouterConfig {
    fn default() -> Self {
        Self {
            api_key: env::var("OPENROUTER_API_KEY").unwrap_or_default(),
            base_url: "https://openrouter.ai/api/v1".to_string(),
            chat_model: "anthropic/claude-3.5-sonnet".to_string(),
            transcription_model: "openai/whisper-large-v3".to_string(),
            max_tokens: 4096,
            temperature: 0.7,
            timeout: 60,
            retry_attempts: 3,
            retry_delay: 1000,
        }
    }
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 3000,
            cors_origins: vec!["http://localhost:3000".to_string()],
            max_request_size: 10 * 1024 * 1024, // 10MB
            request_timeout: 30,
            websocket_ping_interval: 30,
            rate_limit_requests: 100,
            rate_limit_window: 60,
        }
    }
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            level: "info".to_string(),
            file_path: Some(PathBuf::from("./logs/newglass.log")),
            max_file_size: 10 * 1024 * 1024, // 10MB
            max_files: 5,
            console_output: true,
            json_format: false,
        }
    }
}

impl Default for SessionConfig {
    fn default() -> Self {
        Self {
            default_timeout: 3600, // 1 hour
            max_sessions_per_user: 10,
            cleanup_interval: 300, // 5 minutes
            auto_save_interval: 60, // 1 minute
            session_history_limit: 1000,
        }
    }
}

impl Default for TranscriptionConfig {
    fn default() -> Self {
        Self {
            buffer_duration: 3000, // 3 seconds
            min_audio_length: 1000, // 1 second
            silence_threshold: 0.01,
            language: None, // Auto-detect
            auto_detect_language: true,
            enable_timestamps: true,
            enable_word_timestamps: false,
        }
    }
}

impl Default for ChatConfig {
    fn default() -> Self {
        Self {
            max_history_length: 50,
            context_window: 4000,
            system_prompt: None, // Use default from service
            enable_streaming: true,
            response_timeout: 30,
            auto_summarize_threshold: 20,
        }
    }
}

impl Default for SummaryConfig {
    fn default() -> Self {
        Self {
            auto_generate: true,
            trigger_threshold: 10,
            analysis_interval: 300, // 5 minutes
            max_summary_length: 500,
            include_sentiment: true,
            include_topics: true,
        }
    }
}

impl Config {
    /// Load configuration from file or create default
    pub fn load() -> Result<Self> {
        let config_path = Self::get_config_path();
        
        if config_path.exists() {
            let content = fs::read_to_string(&config_path)
                .map_err(|e| anyhow!("Failed to read config file: {}", e))?;
            
            let config: Config = toml::from_str(&content)
                .map_err(|e| anyhow!("Failed to parse config file: {}", e))?;
            
            Ok(config)
        } else {
            let config = Config::default();
            config.save()?;
            Ok(config)
        }
    }
    
    /// Save configuration to file
    pub fn save(&self) -> Result<()> {
        let config_path = Self::get_config_path();
        
        // Create config directory if it doesn't exist
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| anyhow!("Failed to create config directory: {}", e))?;
        }
        
        let content = toml::to_string_pretty(self)
            .map_err(|e| anyhow!("Failed to serialize config: {}", e))?;
        
        fs::write(&config_path, content)
            .map_err(|e| anyhow!("Failed to write config file: {}", e))?;
        
        Ok(())
    }
    
    /// Get the configuration file path
    fn get_config_path() -> PathBuf {
        if let Ok(config_dir) = env::var("NEWGLASS_CONFIG_DIR") {
            PathBuf::from(config_dir).join("config.toml")
        } else {
            PathBuf::from("./config/config.toml")
        }
    }
    
    /// Validate configuration
    pub fn validate(&self) -> Result<()> {
        // Validate OpenRouter API key
        if self.openrouter.api_key.is_empty() {
            return Err(anyhow!("OpenRouter API key is required"));
        }
        
        // Validate audio configuration
        if self.audio.sample_rate == 0 {
            return Err(anyhow!("Audio sample rate must be greater than 0"));
        }
        
        if self.audio.channels == 0 {
            return Err(anyhow!("Audio channels must be greater than 0"));
        }
        
        // Validate server configuration
        if self.server.port == 0 {
            return Err(anyhow!("Server port must be greater than 0"));
        }
        
        // Validate database URL
        if self.database.url.is_empty() {
            return Err(anyhow!("Database URL is required"));
        }
        
        Ok(())
    }
    
    /// Get environment-specific overrides
    pub fn apply_env_overrides(&mut self) {
        // OpenRouter API key
        if let Ok(api_key) = env::var("OPENROUTER_API_KEY") {
            self.openrouter.api_key = api_key;
        }
        
        // Database URL
        if let Ok(db_url) = env::var("DATABASE_URL") {
            self.database.url = db_url;
        }
        
        // Server host and port
        if let Ok(host) = env::var("SERVER_HOST") {
            self.server.host = host;
        }
        
        if let Ok(port) = env::var("SERVER_PORT") {
            if let Ok(port_num) = port.parse::<u16>() {
                self.server.port = port_num;
            }
        }
        
        // Logging level
        if let Ok(log_level) = env::var("LOG_LEVEL") {
            self.logging.level = log_level;
        }
        
        // Chat model
        if let Ok(chat_model) = env::var("CHAT_MODEL") {
            self.openrouter.chat_model = chat_model;
        }
        
        // Transcription model
        if let Ok(transcription_model) = env::var("TRANSCRIPTION_MODEL") {
            self.openrouter.transcription_model = transcription_model;
        }
    }
    
    /// Create a development configuration
    pub fn development() -> Self {
        let mut config = Self::default();
        config.logging.level = "debug".to_string();
        config.server.cors_origins = vec!["*".to_string()];
        config.database.url = "sqlite:./data/dev.db".to_string();
        config
    }
    
    /// Create a production configuration
    pub fn production() -> Self {
        let mut config = Self::default();
        config.logging.level = "warn".to_string();
        config.logging.json_format = true;
        config.server.host = "0.0.0.0".to_string();
        config.database.url = "sqlite:./data/prod.db".to_string();
        config
    }
}

/// Configuration builder for programmatic configuration
pub struct ConfigBuilder {
    config: Config,
}

impl ConfigBuilder {
    pub fn new() -> Self {
        Self {
            config: Config::default(),
        }
    }
    
    pub fn with_database_url(mut self, url: String) -> Self {
        self.config.database.url = url;
        self
    }
    
    pub fn with_openrouter_api_key(mut self, api_key: String) -> Self {
        self.config.openrouter.api_key = api_key;
        self
    }
    
    pub fn with_server_port(mut self, port: u16) -> Self {
        self.config.server.port = port;
        self
    }
    
    pub fn with_log_level(mut self, level: String) -> Self {
        self.config.logging.level = level;
        self
    }
    
    pub fn with_audio_config(mut self, audio: AudioConfig) -> Self {
        self.config.audio = audio;
        self
    }
    
    pub fn build(self) -> Config {
        self.config
    }
}

impl Default for ConfigBuilder {
    fn default() -> Self {
        Self::new()
    }
}