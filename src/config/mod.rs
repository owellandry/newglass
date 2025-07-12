use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub openrouter: OpenRouterConfig,
    pub audio: AudioConfig,
    pub encryption: EncryptionConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub cors_origins: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub path: PathBuf,
    pub max_connections: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenRouterConfig {
    pub api_key: Option<String>,
    pub base_url: String,
    pub default_model: String,
    pub stt_model: String,
    pub chat_model: String,
    pub summary_model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioConfig {
    pub sample_rate: u32,
    pub channels: u16,
    pub buffer_size: usize,
    pub enable_echo_cancellation: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionConfig {
    pub key_derivation_iterations: u32,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                host: "127.0.0.1".to_string(),
                port: 3000,
                cors_origins: vec!["http://localhost:3000".to_string()],
            },
            database: DatabaseConfig {
                path: PathBuf::from("./data/newglass.db"),
                max_connections: 10,
            },
            openrouter: OpenRouterConfig {
                api_key: None,
                base_url: "https://openrouter.ai/api/v1".to_string(),
                default_model: "anthropic/claude-3.5-sonnet".to_string(),
                stt_model: "openai/whisper-large-v3".to_string(),
                chat_model: "anthropic/claude-3.5-sonnet".to_string(),
                summary_model: "anthropic/claude-3.5-sonnet".to_string(),
            },
            audio: AudioConfig {
                sample_rate: 16000,
                channels: 1,
                buffer_size: 1024,
                enable_echo_cancellation: true,
            },
            encryption: EncryptionConfig {
                key_derivation_iterations: 100_000,
            },
        }
    }
}

impl AppConfig {
    pub async fn load() -> Result<Self> {
        // Try to load from config file, fallback to default
        let config_path = "config.toml";
        
        if std::path::Path::new(config_path).exists() {
            let content = tokio::fs::read_to_string(config_path).await?;
            let config: AppConfig = toml::from_str(&content)?;
            Ok(config)
        } else {
            // Create default config file
            let default_config = Self::default();
            let content = toml::to_string_pretty(&default_config)?;
            tokio::fs::write(config_path, content).await?;
            Ok(default_config)
        }
    }
    
    pub fn validate(&self) -> Result<()> {
        if self.server.port == 0 {
            return Err(anyhow::anyhow!("Server port cannot be 0"));
        }
        
        if self.openrouter.api_key.is_none() {
            tracing::warn!("OpenRouter API key not configured. Some features may not work.");
        }
        
        Ok(())
    }
}