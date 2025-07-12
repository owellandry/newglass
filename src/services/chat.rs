use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tracing::{info, error};
use uuid::Uuid;

use crate::config::OpenRouterConfig;
use crate::core::events::AppEvent;
use crate::services::openrouter::{OpenRouterClient, ChatMessage};

pub struct ChatService {
    client: OpenRouterClient,
    event_tx: broadcast::Sender<AppEvent>,
    
    // Conversation history for each session
    conversations: Arc<RwLock<HashMap<Uuid, Vec<ChatMessage>>>>,
    
    // System prompts
    system_prompt: String,
}

const DEFAULT_SYSTEM_PROMPT: &str = r#"
You are NewGlass, an intelligent AI assistant that helps users during meetings and conversations.

Your capabilities:
- You can see transcriptions of conversations in real-time
- You can answer questions about the current conversation
- You can provide summaries and action items
- You can help with follow-up tasks

Guidelines:
- Be concise and helpful
- Focus on the current conversation context
- Provide actionable insights when possible
- If you don't have enough context, ask for clarification
- Be professional but friendly
"#;

impl ChatService {
    pub async fn new(
        config: OpenRouterConfig,
        event_tx: broadcast::Sender<AppEvent>,
    ) -> Result<Self> {
        let client = OpenRouterClient::new(config)?;
        
        Ok(Self {
            client,
            event_tx,
            conversations: Arc::new(RwLock::new(HashMap::new())),
            system_prompt: DEFAULT_SYSTEM_PROMPT.to_string(),
        })
    }
    
    pub async fn process_message(
        &self,
        session_id: Uuid,
        message: String,
    ) -> Result<String> {
        info!("Processing chat message for session {}: {}", session_id, message);
        
        // Add user message to conversation
        self.add_message(session_id, "user".to_string(), message.clone()).await;
        
        // Get conversation history
        let messages = self.build_conversation_context(session_id).await;
        
        // Get response from OpenRouter
        match self.client.chat_completion(
            self.client.get_default_chat_model(),
            messages,
            Some(1000), // max tokens
            Some(0.7),  // temperature
        ).await {
            Ok(response) => {
                info!("Chat response for session {}: {}", session_id, response);
                
                // Add assistant response to conversation
                self.add_message(session_id, "assistant".to_string(), response.clone()).await;
                
                // Send response event
                let event = AppEvent::ChatResponseReceived {
                    session_id,
                    response: response.clone(),
                };
                
                if let Err(e) = self.event_tx.send(event) {
                    error!("Failed to send chat response event: {}", e);
                }
                
                Ok(response)
            },
            Err(e) => {
                error!("Chat completion failed for session {}: {}", session_id, e);
                
                let event = AppEvent::ErrorOccurred {
                    session_id: Some(session_id),
                    error: format!("Chat error: {}", e),
                    service: "chat".to_string(),
                };
                
                if let Err(e) = self.event_tx.send(event) {
                    error!("Failed to send error event: {}", e);
                }
                
                Err(e)
            }
        }
    }
    
    pub async fn process_message_stream(
        &self,
        session_id: Uuid,
        message: String,
        callback: impl Fn(String) -> Result<()>,
    ) -> Result<String> {
        info!("Processing streaming chat message for session {}: {}", session_id, message);
        
        // Add user message to conversation
        self.add_message(session_id, "user".to_string(), message.clone()).await;
        
        // Get conversation history
        let messages = self.build_conversation_context(session_id).await;
        
        // Get streaming response from OpenRouter
        match self.client.stream_chat_completion(
            self.client.get_default_chat_model(),
            messages,
            callback,
        ).await {
            Ok(response) => {
                info!("Streaming chat response completed for session {}", session_id);
                
                // Add assistant response to conversation
                self.add_message(session_id, "assistant".to_string(), response.clone()).await;
                
                Ok(response)
            },
            Err(e) => {
                error!("Streaming chat completion failed for session {}: {}", session_id, e);
                Err(e)
            }
        }
    }
    
    async fn add_message(&self, session_id: Uuid, role: String, content: String) {
        let mut conversations = self.conversations.write().await;
        let conversation = conversations.entry(session_id).or_insert_with(Vec::new);
        
        conversation.push(ChatMessage { role, content });
        
        // Keep conversation history manageable (last 20 messages)
        if conversation.len() > 20 {
            conversation.drain(0..conversation.len() - 20);
        }
    }
    
    async fn build_conversation_context(&self, session_id: Uuid) -> Vec<ChatMessage> {
        let mut messages = vec![
            ChatMessage {
                role: "system".to_string(),
                content: self.system_prompt.clone(),
            }
        ];
        
        // Add conversation history
        let conversations = self.conversations.read().await;
        if let Some(conversation) = conversations.get(&session_id) {
            messages.extend(conversation.clone());
        }
        
        messages
    }
    
    pub async fn add_context_from_transcription(
        &self,
        session_id: Uuid,
        speaker: String,
        text: String,
    ) -> Result<()> {
        // Add transcription as context (not as a direct message)
        let context_message = format!("[Transcription - {}]: {}", speaker, text);
        
        let mut conversations = self.conversations.write().await;
        let conversation = conversations.entry(session_id).or_insert_with(Vec::new);
        
        // Add as a system message to provide context
        conversation.push(ChatMessage {
            role: "system".to_string(),
            content: context_message,
        });
        
        // Keep conversation history manageable
        if conversation.len() > 30 {
            conversation.drain(0..conversation.len() - 30);
        }
        
        Ok(())
    }
    
    pub async fn get_conversation_summary(&self, session_id: Uuid) -> Result<String> {
        let conversations = self.conversations.read().await;
        
        if let Some(conversation) = conversations.get(&session_id) {
            if conversation.is_empty() {
                return Ok("No conversation history available.".to_string());
            }
            
            // Create a summary prompt
            let mut summary_messages = vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: "Provide a brief summary of the following conversation. Focus on key points, decisions, and action items.".to_string(),
                }
            ];
            
            // Add conversation history
            summary_messages.extend(conversation.clone());
            
            // Add summary request
            summary_messages.push(ChatMessage {
                role: "user".to_string(),
                content: "Please provide a summary of this conversation.".to_string(),
            });
            
            self.client.chat_completion(
                self.client.get_default_chat_model(),
                summary_messages,
                Some(500),
                Some(0.3),
            ).await
        } else {
            Ok("No conversation found for this session.".to_string())
        }
    }
    
    pub async fn start_session(&self, session_id: Uuid) -> Result<()> {
        info!("Starting chat session: {}", session_id);
        
        // Initialize conversation for this session
        let mut conversations = self.conversations.write().await;
        conversations.insert(session_id, Vec::new());
        
        Ok(())
    }
    
    pub async fn end_session(&self, session_id: Uuid) -> Result<()> {
        info!("Ending chat session: {}", session_id);
        
        // Keep conversation in memory for a while, don't immediately remove
        // This allows for post-session queries
        
        Ok(())
    }
    
    pub async fn clear_session(&self, session_id: Uuid) -> Result<()> {
        info!("Clearing chat session: {}", session_id);
        
        let mut conversations = self.conversations.write().await;
        conversations.remove(&session_id);
        
        Ok(())
    }
    
    pub async fn get_active_sessions(&self) -> Vec<Uuid> {
        let conversations = self.conversations.read().await;
        conversations.keys().copied().collect()
    }
    
    pub async fn update_system_prompt(&self, new_prompt: String) {
        // Note: This would require making system_prompt mutable
        // For now, we'll log the request
        info!("System prompt update requested: {}", new_prompt);
    }
}