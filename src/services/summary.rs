use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tokio::time::{interval, Duration};
use tracing::{info, error, warn};
use uuid::Uuid;

use crate::config::OpenRouterConfig;
use crate::core::events::{AppEvent, SummaryData};
use crate::services::openrouter::{OpenRouterClient, ChatMessage};

pub struct SummaryService {
    client: OpenRouterClient,
    event_tx: broadcast::Sender<AppEvent>,
    
    // Conversation data for each session
    conversations: Arc<RwLock<HashMap<Uuid, ConversationData>>>,
    
    // Configuration
    analysis_threshold: usize,
    auto_summary_interval: Duration,
}

#[derive(Debug, Clone)]
struct ConversationData {
    transcripts: Vec<TranscriptEntry>,
    last_analysis: chrono::DateTime<chrono::Utc>,
    last_summary: Option<SummaryData>,
    turn_count: usize,
}

#[derive(Debug, Clone)]
struct TranscriptEntry {
    speaker: String,
    text: String,
    timestamp: chrono::DateTime<chrono::Utc>,
}

const DEFAULT_ANALYSIS_THRESHOLD: usize = 10; // Analyze after 10 new turns
const DEFAULT_AUTO_SUMMARY_INTERVAL_MINUTES: u64 = 5; // Auto-summary every 5 minutes

const SUMMARY_PROMPT: &str = r#"
Analyze the following conversation and provide a structured summary.

Please provide:
1. TLDR: A one-sentence summary
2. Key Points: Main topics discussed (bullet points)
3. Action Items: Specific tasks or follow-ups mentioned
4. Decisions Made: Any decisions or conclusions reached
5. Next Steps: What should happen next

Conversation:
"#;

impl ConversationData {
    fn new() -> Self {
        Self {
            transcripts: Vec::new(),
            last_analysis: chrono::Utc::now(),
            last_summary: None,
            turn_count: 0,
        }
    }
    
    fn add_transcript(&mut self, speaker: String, text: String) {
        self.transcripts.push(TranscriptEntry {
            speaker,
            text,
            timestamp: chrono::Utc::now(),
        });
        self.turn_count += 1;
    }
    
    fn should_analyze(&self, threshold: usize) -> bool {
        self.turn_count >= threshold
    }
    
    fn format_for_analysis(&self, max_entries: usize) -> String {
        let entries_to_include = if self.transcripts.len() > max_entries {
            &self.transcripts[self.transcripts.len() - max_entries..]
        } else {
            &self.transcripts
        };
        
        entries_to_include
            .iter()
            .map(|entry| format!("{}: {}", entry.speaker, entry.text))
            .collect::<Vec<_>>()
            .join("\n")
    }
    
    fn reset_analysis_counter(&mut self) {
        self.turn_count = 0;
        self.last_analysis = chrono::Utc::now();
    }
}

impl SummaryService {
    pub async fn new(
        config: OpenRouterConfig,
        event_tx: broadcast::Sender<AppEvent>,
    ) -> Result<Self> {
        let client = OpenRouterClient::new(config)?;
        
        let service = Self {
            client,
            event_tx,
            conversations: Arc::new(RwLock::new(HashMap::new())),
            analysis_threshold: DEFAULT_ANALYSIS_THRESHOLD,
            auto_summary_interval: Duration::from_secs(DEFAULT_AUTO_SUMMARY_INTERVAL_MINUTES * 60),
        };
        
        // Start auto-summary task
        service.start_auto_summary_task().await;
        
        Ok(service)
    }
    
    pub async fn add_conversation_turn(
        &self,
        session_id: Uuid,
        speaker: String,
        text: String,
    ) -> Result<()> {
        info!(
            "Adding conversation turn for session {} - {}: {}",
            session_id, speaker, text
        );
        
        // Add to conversation data
        {
            let mut conversations = self.conversations.write().await;
            let conversation = conversations.entry(session_id).or_insert_with(ConversationData::new);
            conversation.add_transcript(speaker, text);
        }
        
        // Check if we should trigger analysis
        let should_analyze = {
            let conversations = self.conversations.read().await;
            conversations.get(&session_id)
                .map(|c| c.should_analyze(self.analysis_threshold))
                .unwrap_or(false)
        };
        
        if should_analyze {
            self.analyze_conversation(session_id).await?;
        }
        
        Ok(())
    }
    
    pub async fn analyze_conversation(&self, session_id: Uuid) -> Result<()> {
        info!("Analyzing conversation for session: {}", session_id);
        
        let conversation_text = {
            let mut conversations = self.conversations.write().await;
            if let Some(conversation) = conversations.get_mut(&session_id) {
                let text = conversation.format_for_analysis(30); // Last 30 entries
                conversation.reset_analysis_counter();
                text
            } else {
                return Ok(()); // No conversation data
            }
        };
        
        if conversation_text.trim().is_empty() {
            return Ok(());
        }
        
        // Generate summary
        match self.generate_summary(&conversation_text).await {
            Ok(summary) => {
                info!("Summary generated for session {}: {}", session_id, summary.tldr);
                
                // Store summary
                {
                    let mut conversations = self.conversations.write().await;
                    if let Some(conversation) = conversations.get_mut(&session_id) {
                        conversation.last_summary = Some(summary.clone());
                    }
                }
                
                // Send summary event
                let event = AppEvent::SummaryGenerated {
                    session_id,
                    summary: serde_json::to_string(&summary)?,
                };
                
                if let Err(e) = self.event_tx.send(event) {
                    error!("Failed to send summary event: {}", e);
                }
            },
            Err(e) => {
                error!("Failed to generate summary for session {}: {}", session_id, e);
                
                let event = AppEvent::ErrorOccurred {
                    session_id: Some(session_id),
                    error: format!("Summary generation error: {}", e),
                    service: "summary".to_string(),
                };
                
                if let Err(e) = self.event_tx.send(event) {
                    error!("Failed to send error event: {}", e);
                }
            }
        }
        
        Ok(())
    }
    
    async fn generate_summary(&self, conversation_text: &str) -> Result<SummaryData> {
        let messages = vec![
            ChatMessage {
                role: "system".to_string(),
                content: SUMMARY_PROMPT.to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: conversation_text.to_string(),
            },
        ];
        
        let response = self.client.chat_completion(
            self.client.get_default_summary_model(),
            messages,
            Some(800),
            Some(0.3),
        ).await?;
        
        // Parse the response into structured data
        self.parse_summary_response(&response)
    }
    
    fn parse_summary_response(&self, response: &str) -> Result<SummaryData> {
        // Simple parsing - in a real implementation, you might want more sophisticated parsing
        let mut tldr = String::new();
        let mut key_points = Vec::new();
        let mut action_items = Vec::new();
        
        let lines: Vec<&str> = response.lines().collect();
        let mut current_section = "";
        
        for line in lines {
            let line = line.trim();
            
            if line.to_lowercase().contains("tldr") {
                current_section = "tldr";
                // Extract TLDR from the same line if present
                if let Some(colon_pos) = line.find(':') {
                    tldr = line[colon_pos + 1..].trim().to_string();
                }
            } else if line.to_lowercase().contains("key points") {
                current_section = "key_points";
            } else if line.to_lowercase().contains("action items") {
                current_section = "action_items";
            } else if !line.is_empty() {
                match current_section {
                    "tldr" if tldr.is_empty() => {
                        tldr = line.to_string();
                    },
                    "key_points" => {
                        if line.starts_with('-') || line.starts_with('•') || line.starts_with('*') {
                            key_points.push(line[1..].trim().to_string());
                        } else if !line.contains(':') {
                            key_points.push(line.to_string());
                        }
                    },
                    "action_items" => {
                        if line.starts_with('-') || line.starts_with('•') || line.starts_with('*') {
                            action_items.push(line[1..].trim().to_string());
                        } else if !line.contains(':') {
                            action_items.push(line.to_string());
                        }
                    },
                    _ => {}
                }
            }
        }
        
        // Fallback: if parsing failed, use the whole response as summary
        if tldr.is_empty() {
            tldr = response.lines().next().unwrap_or("Summary generated").to_string();
        }
        
        Ok(SummaryData {
            tldr,
            full_summary: response.to_string(),
            action_items,
            key_points,
            timestamp: chrono::Utc::now(),
        })
    }
    
    async fn start_auto_summary_task(&self) {
        let conversations = self.conversations.clone();
        let event_tx = self.event_tx.clone();
        let interval_duration = self.auto_summary_interval;
        
        tokio::spawn(async move {
            let mut interval = interval(interval_duration);
            
            loop {
                interval.tick().await;
                
                // Check all active sessions for auto-summary
                let session_ids: Vec<Uuid> = {
                    let conversations = conversations.read().await;
                    conversations.keys().copied().collect()
                };
                
                for session_id in session_ids {
                    // Send auto-summary request
                    let event = AppEvent::SummaryRequested { session_id };
                    
                    if let Err(e) = event_tx.send(event) {
                        warn!("Failed to send auto-summary request: {}", e);
                    }
                }
            }
        });
    }
    
    pub async fn force_summary(&self, session_id: Uuid) -> Result<SummaryData> {
        info!("Force generating summary for session: {}", session_id);
        
        let conversation_text = {
            let conversations = self.conversations.read().await;
            conversations.get(&session_id)
                .map(|c| c.format_for_analysis(50)) // More entries for forced summary
                .unwrap_or_default()
        };
        
        if conversation_text.trim().is_empty() {
            return Err(anyhow::anyhow!("No conversation data available for summary"));
        }
        
        self.generate_summary(&conversation_text).await
    }
    
    pub async fn get_last_summary(&self, session_id: Uuid) -> Option<SummaryData> {
        let conversations = self.conversations.read().await;
        conversations.get(&session_id)
            .and_then(|c| c.last_summary.clone())
    }
    
    pub async fn start_session(&self, session_id: Uuid) -> Result<()> {
        info!("Starting summary session: {}", session_id);
        
        let mut conversations = self.conversations.write().await;
        conversations.insert(session_id, ConversationData::new());
        
        Ok(())
    }
    
    pub async fn end_session(&self, session_id: Uuid) -> Result<()> {
        info!("Ending summary session: {}", session_id);
        
        // Generate final summary before ending
        if let Err(e) = self.analyze_conversation(session_id).await {
            warn!("Failed to generate final summary for session {}: {}", session_id, e);
        }
        
        Ok(())
    }
    
    pub async fn clear_session(&self, session_id: Uuid) -> Result<()> {
        info!("Clearing summary session: {}", session_id);
        
        let mut conversations = self.conversations.write().await;
        conversations.remove(&session_id);
        
        Ok(())
    }
    
    pub async fn get_active_sessions(&self) -> Vec<Uuid> {
        let conversations = self.conversations.read().await;
        conversations.keys().copied().collect()
    }
}