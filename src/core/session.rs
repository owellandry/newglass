use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;
use std::str::FromStr;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: Uuid,
    pub user_id: String,
    pub session_type: SessionType,
    pub status: SessionStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SessionType {
    Listen,
    Chat,
    Mixed, // Both listening and chatting
}

impl fmt::Display for SessionType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SessionType::Listen => write!(f, "listen"),
            SessionType::Chat => write!(f, "chat"),
            SessionType::Mixed => write!(f, "mixed"),
        }
    }
}

impl FromStr for SessionType {
    type Err = anyhow::Error;
    
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "listen" => Ok(SessionType::Listen),
            "chat" => Ok(SessionType::Chat),
            "mixed" => Ok(SessionType::Mixed),
            _ => Err(anyhow::anyhow!("Invalid session type: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SessionStatus {
    Active,
    Paused,
    Ended,
}

impl fmt::Display for SessionStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SessionStatus::Active => write!(f, "active"),
            SessionStatus::Paused => write!(f, "paused"),
            SessionStatus::Ended => write!(f, "ended"),
        }
    }
}

impl FromStr for SessionStatus {
    type Err = anyhow::Error;
    
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "active" => Ok(SessionStatus::Active),
            "paused" => Ok(SessionStatus::Paused),
            "ended" => Ok(SessionStatus::Ended),
            _ => Err(anyhow::anyhow!("Invalid session status: {}", s)),
        }
    }
}

#[derive(Debug)]
pub struct SessionManager {
    sessions: Arc<RwLock<HashMap<Uuid, Session>>>,
}

impl Session {
    pub fn new(
        user_id: Option<String>,
        session_type: SessionType,
        metadata: Option<HashMap<String, serde_json::Value>>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            user_id: user_id.unwrap_or_default(),
            session_type,
            status: SessionStatus::Active,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            metadata: metadata.unwrap_or_default().into_iter()
                .map(|(k, v)| (k, v.to_string()))
                .collect(),
        }
    }
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    pub async fn create_session(
        &self,
        user_id: String,
        session_type: SessionType,
    ) -> Result<Session> {
        let session = Session {
            id: Uuid::new_v4(),
            user_id,
            session_type,
            status: SessionStatus::Active,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            metadata: HashMap::new(),
        };
        
        let mut sessions = self.sessions.write().await;
        sessions.insert(session.id, session.clone());
        
        Ok(session)
    }
    
    pub async fn get_session(&self, session_id: Uuid) -> Option<Session> {
        let sessions = self.sessions.read().await;
        sessions.get(&session_id).cloned()
    }
    
    pub async fn update_session_status(
        &self,
        session_id: Uuid,
        status: SessionStatus,
    ) -> Result<()> {
        let mut sessions = self.sessions.write().await;
        
        if let Some(session) = sessions.get_mut(&session_id) {
            session.status = status;
            session.updated_at = Utc::now();
        }
        
        Ok(())
    }
    
    pub async fn end_session(&self, session_id: Uuid) -> Result<()> {
        self.update_session_status(session_id, SessionStatus::Ended).await
    }
    
    pub async fn get_active_sessions(&self) -> Vec<Session> {
        let sessions = self.sessions.read().await;
        sessions
            .values()
            .filter(|s| matches!(s.status, SessionStatus::Active))
            .cloned()
            .collect()
    }
    
    pub async fn cleanup_old_sessions(&self, max_age_hours: i64) -> Result<usize> {
        let cutoff = Utc::now() - chrono::Duration::hours(max_age_hours);
        let mut sessions = self.sessions.write().await;
        
        let old_sessions: Vec<Uuid> = sessions
            .iter()
            .filter(|(_, session)| {
                matches!(session.status, SessionStatus::Ended) 
                    && session.updated_at < cutoff
            })
            .map(|(id, _)| *id)
            .collect();
        
        let count = old_sessions.len();
        for id in old_sessions {
            sessions.remove(&id);
        }
        
        Ok(count)
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}