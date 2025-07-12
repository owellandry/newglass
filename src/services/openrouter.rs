use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;
use tracing::{info, error, warn};

use crate::config::OpenRouterConfig;

#[derive(Clone)]
pub struct OpenRouterClient {
    client: Client,
    config: OpenRouterConfig,
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
    stream: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
    usage: Option<Usage>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ChatMessage,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Usage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

#[derive(Debug, Serialize)]
struct TranscriptionRequest {
    model: String,
    file: String, // Base64 encoded audio
    language: Option<String>,
    response_format: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TranscriptionResponse {
    text: String,
}

impl OpenRouterClient {
    pub fn new(config: OpenRouterConfig) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(60))
            .build()?;
        
        Ok(Self { client, config })
    }
    
    pub async fn chat_completion(
        &self,
        model: &str,
        messages: Vec<ChatMessage>,
        max_tokens: Option<u32>,
        temperature: Option<f32>,
    ) -> Result<String> {
        let api_key = {
            if self.config.api_key.is_empty() {
                return Err(anyhow::anyhow!("OpenRouter API key not configured"));
            }
            self.config.api_key.clone()
        };
        
        let request = ChatRequest {
            model: model.to_string(),
            messages,
            max_tokens,
            temperature,
            stream: Some(false),
        };
        
        let response = self.client
            .post(&format!("{}/chat/completions", self.config.base_url))
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .header("HTTP-Referer", "https://github.com/newglass/newglass")
            .header("X-Title", "NewGlass")
            .json(&request)
            .send()
            .await?;
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!(
                "OpenRouter API error: {} - {}",
                status,
                error_text
            ));
        }
        
        let chat_response: ChatResponse = response.json().await?;
        
        if let Some(choice) = chat_response.choices.first() {
            if let Some(usage) = chat_response.usage {
                info!(
                    "OpenRouter usage - Model: {}, Tokens: {} (prompt: {}, completion: {})",
                    model, usage.total_tokens, usage.prompt_tokens, usage.completion_tokens
                );
            }
            
            Ok(choice.message.content.clone())
        } else {
            Err(anyhow::anyhow!("No response from OpenRouter"))
        }
    }
    
    pub async fn transcribe_audio(
        &self,
        audio_data: &[u8],
        language: Option<&str>,
    ) -> Result<String> {
        let api_key = {
            if self.config.api_key.is_empty() {
                return Err(anyhow::anyhow!("OpenRouter API key not configured"));
            }
            self.config.api_key.clone()
        };
        
        // Convert audio to base64
        let audio_base64 = base64::encode(audio_data);
        
        let request = TranscriptionRequest {
            model: self.config.transcription_model.clone(),
            file: audio_base64,
            language: language.map(|s| s.to_string()),
            response_format: Some("json".to_string()),
        };
        
        let response = self.client
            .post(&format!("{}/audio/transcriptions", self.config.base_url))
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .header("HTTP-Referer", "https://github.com/newglass/newglass")
            .header("X-Title", "NewGlass")
            .json(&request)
            .send()
            .await?;
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!(
                "OpenRouter transcription error: {} - {}",
                status,
                error_text
            ));
        }
        
        let transcription_response: TranscriptionResponse = response.json().await?;
        Ok(transcription_response.text)
    }
    
    pub async fn stream_chat_completion(
        &self,
        model: &str,
        messages: Vec<ChatMessage>,
        callback: impl Fn(String) -> Result<()>,
    ) -> Result<String> {
        let api_key = {
            if self.config.api_key.is_empty() {
                return Err(anyhow::anyhow!("OpenRouter API key not configured"));
            }
            self.config.api_key.clone()
        };
        
        let request = ChatRequest {
            model: model.to_string(),
            messages,
            max_tokens: None,
            temperature: None,
            stream: Some(true),
        };
        
        let response = self.client
            .post(&format!("{}/chat/completions", self.config.base_url))
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .header("HTTP-Referer", "https://github.com/newglass/newglass")
            .header("X-Title", "NewGlass")
            .json(&request)
            .send()
            .await?;
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!(
                "OpenRouter streaming error: {} - {}",
                status,
                error_text
            ));
        }
        
        // Handle streaming response
        let mut full_response = String::new();
        let mut stream = response.bytes_stream();
        
        use futures_util::StreamExt;
        
        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            let chunk_str = String::from_utf8_lossy(&chunk);
            
            // Parse SSE format
            for line in chunk_str.lines() {
                if line.starts_with("data: ") {
                    let data = &line[6..];
                    if data == "[DONE]" {
                        break;
                    }
                    
                    if let Ok(json) = serde_json::from_str::<Value>(data) {
                        if let Some(choices) = json["choices"].as_array() {
                            if let Some(choice) = choices.first() {
                                if let Some(delta) = choice["delta"].as_object() {
                                    if let Some(content) = delta["content"].as_str() {
                                        full_response.push_str(content);
                                        callback(content.to_string())?;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        Ok(full_response)
    }
    
    pub fn get_default_chat_model(&self) -> &str {
        &self.config.chat_model
    }
    
    pub fn get_default_stt_model(&self) -> &str {
        &self.config.transcription_model
    }

    pub fn get_default_summary_model(&self) -> &str {
        &self.config.chat_model
    }
}
