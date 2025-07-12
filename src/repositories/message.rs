use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Row};
use std::collections::HashMap;
use uuid::Uuid;

use crate::repositories::{DbPool, Repository};

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct MessageEntity {
    pub id: String,
    pub session_id: String,
    pub role: String, // "user", "assistant", "system"
    pub content: String,
    pub model: Option<String>,
    pub tokens_used: Option<i32>,
    pub response_time: Option<f32>, // Response time in seconds
    pub created_at: DateTime<Utc>,
    pub metadata: Option<String>, // JSON string for additional data
    pub parent_message_id: Option<String>,
    pub is_edited: bool,
    pub edit_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: Uuid,
    pub session_id: Uuid,
    pub role: MessageRole,
    pub content: String,
    pub model: Option<String>,
    pub tokens_used: Option<i32>,
    pub response_time: Option<f32>,
    pub created_at: DateTime<Utc>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    pub parent_message_id: Option<Uuid>,
    pub is_edited: bool,
    pub edit_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

impl std::fmt::Display for MessageRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MessageRole::User => write!(f, "user"),
            MessageRole::Assistant => write!(f, "assistant"),
            MessageRole::System => write!(f, "system"),
        }
    }
}

impl std::str::FromStr for MessageRole {
    type Err = anyhow::Error;
    
    fn from_str(s: &str) -> Result<Self> {
        match s.to_lowercase().as_str() {
            "user" => Ok(MessageRole::User),
            "assistant" => Ok(MessageRole::Assistant),
            "system" => Ok(MessageRole::System),
            _ => Err(anyhow::anyhow!("Invalid message role: {}", s)),
        }
    }
}

impl From<Message> for MessageEntity {
    fn from(message: Message) -> Self {
        Self {
            id: message.id.to_string(),
            session_id: message.session_id.to_string(),
            role: message.role.to_string(),
            content: message.content,
            model: message.model,
            tokens_used: message.tokens_used,
            response_time: message.response_time,
            created_at: message.created_at,
            metadata: message.metadata.map(|m| serde_json::to_string(&m).unwrap_or_default()),
            parent_message_id: message.parent_message_id.map(|id| id.to_string()),
            is_edited: message.is_edited,
            edit_count: message.edit_count,
        }
    }
}

impl TryFrom<MessageEntity> for Message {
    type Error = anyhow::Error;
    
    fn try_from(entity: MessageEntity) -> Result<Self> {
        let metadata = if let Some(metadata_str) = entity.metadata {
            if !metadata_str.is_empty() {
                Some(serde_json::from_str(&metadata_str)?)
            } else {
                None
            }
        } else {
            None
        };
        
        let parent_message_id = if let Some(parent_id_str) = entity.parent_message_id {
            Some(Uuid::parse_str(&parent_id_str)?)
        } else {
            None
        };
        
        Ok(Self {
            id: Uuid::parse_str(&entity.id)?,
            session_id: Uuid::parse_str(&entity.session_id)?,
            role: entity.role.parse()?,
            content: entity.content,
            model: entity.model,
            tokens_used: entity.tokens_used,
            response_time: entity.response_time,
            created_at: entity.created_at,
            metadata,
            parent_message_id,
            is_edited: entity.is_edited,
            edit_count: entity.edit_count,
        })
    }
}

pub struct MessageRepository {
    pool: DbPool,
}

impl MessageRepository {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }
    
    pub async fn find_by_session_id(&self, session_id: Uuid) -> Result<Vec<Message>> {
        let entities = sqlx::query_as::<_, MessageEntity>(
            "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC"
        )
        .bind(session_id.to_string())
        .fetch_all(&**self.pool)
        .await?;
        
        let mut messages = Vec::new();
        for entity in entities {
            messages.push(entity.try_into()?);
        }
        
        Ok(messages)
    }
    
    pub async fn find_conversation_history(
        &self, 
        session_id: Uuid, 
        limit: Option<i64>
    ) -> Result<Vec<Message>> {
        let query = if let Some(limit) = limit {
            sqlx::query_as::<_, MessageEntity>(
                "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?"
            )
            .bind(session_id.to_string())
            .bind(limit)
        } else {
            sqlx::query_as::<_, MessageEntity>(
                "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at DESC"
            )
            .bind(session_id.to_string())
        };
        
        let entities = query.fetch_all(&**self.pool).await?;
        
        let mut messages = Vec::new();
        for entity in entities {
            messages.push(entity.try_into()?);
        }
        
        // Reverse to get chronological order
        messages.reverse();
        Ok(messages)
    }
    
    pub async fn find_by_role(&self, session_id: Uuid, role: MessageRole) -> Result<Vec<Message>> {
        let entities = sqlx::query_as::<_, MessageEntity>(
            "SELECT * FROM messages WHERE session_id = ? AND role = ? ORDER BY created_at ASC"
        )
        .bind(session_id.to_string())
        .bind(role.to_string())
        .fetch_all(&**self.pool)
        .await?;
        
        let mut messages = Vec::new();
        for entity in entities {
            messages.push(entity.try_into()?);
        }
        
        Ok(messages)
    }
    
    pub async fn search_content(&self, session_id: Uuid, query: &str) -> Result<Vec<Message>> {
        let search_query = format!("%{}%", query);
        let entities = sqlx::query_as::<_, MessageEntity>(
            "SELECT * FROM messages WHERE session_id = ? AND content LIKE ? ORDER BY created_at DESC"
        )
        .bind(session_id.to_string())
        .bind(search_query)
        .fetch_all(&**self.pool)
        .await?;
        
        let mut messages = Vec::new();
        for entity in entities {
            messages.push(entity.try_into()?);
        }
        
        Ok(messages)
    }
    
    pub async fn get_session_stats(&self, session_id: Uuid) -> Result<MessageStats> {
        let row = sqlx::query(
            r#"
            SELECT 
                COUNT(*) as total_count,
                SUM(tokens_used) as total_tokens,
                AVG(response_time) as avg_response_time,
                COUNT(CASE WHEN role = 'user' THEN 1 END) as user_messages,
                COUNT(CASE WHEN role = 'assistant' THEN 1 END) as assistant_messages
            FROM messages 
            WHERE session_id = ?
            "#
        )
        .bind(session_id.to_string())
        .fetch_one(&**self.pool)
        .await?;
        
        Ok(MessageStats {
            total_count: row.get("total_count"),
            total_tokens: row.get::<Option<i64>, _>("total_tokens").unwrap_or(0),
            avg_response_time: row.get::<Option<f64>, _>("avg_response_time").map(|v| v as f32),
            user_messages: row.get("user_messages"),
            assistant_messages: row.get("assistant_messages"),
        })
    }
    
    pub async fn get_model_usage_stats(&self) -> Result<Vec<ModelUsage>> {
        let rows = sqlx::query(
            r#"
            SELECT 
                model,
                COUNT(*) as usage_count,
                SUM(tokens_used) as total_tokens,
                AVG(response_time) as avg_response_time
            FROM messages 
            WHERE model IS NOT NULL AND role = 'assistant'
            GROUP BY model
            ORDER BY usage_count DESC
            "#
        )
        .fetch_all(&**self.pool)
        .await?;
        
        let mut stats = Vec::new();
        for row in rows {
            stats.push(ModelUsage {
                model: row.get("model"),
                usage_count: row.get("usage_count"),
                total_tokens: row.get::<Option<i64>, _>("total_tokens").unwrap_or(0),
                avg_response_time: row.get::<Option<f64>, _>("avg_response_time").map(|v| v as f32),
            });
        }
        
        Ok(stats)
    }
    
    pub async fn mark_as_edited(&self, id: Uuid) -> Result<()> {
        sqlx::query(
            "UPDATE messages SET is_edited = true, edit_count = edit_count + 1 WHERE id = ?"
        )
        .bind(id.to_string())
        .execute(&**self.pool)
        .await?;
        
        Ok(())
    }
    
    pub async fn update_content(&self, id: Uuid, new_content: String) -> Result<()> {
        sqlx::query(
            "UPDATE messages SET content = ?, is_edited = true, edit_count = edit_count + 1 WHERE id = ?"
        )
        .bind(new_content)
        .bind(id.to_string())
        .execute(&**self.pool)
        .await?;
        
        Ok(())
    }
    
    pub async fn delete_session_messages(&self, session_id: Uuid) -> Result<u64> {
        let result = sqlx::query(
            "DELETE FROM messages WHERE session_id = ?"
        )
        .bind(session_id.to_string())
        .execute(&**self.pool)
        .await?;
        
        Ok(result.rows_affected())
    }
    
    pub async fn cleanup_old_messages(&self, days: i64) -> Result<u64> {
        let cutoff_date = Utc::now() - chrono::Duration::days(days);
        
        let result = sqlx::query(
            "DELETE FROM messages WHERE created_at < ?"
        )
        .bind(cutoff_date)
        .execute(&**self.pool)
        .await?;
        
        Ok(result.rows_affected())
    }
    
    pub async fn get_recent_messages(&self, limit: i64) -> Result<Vec<Message>> {
        let entities = sqlx::query_as::<_, MessageEntity>(
            "SELECT * FROM messages ORDER BY created_at DESC LIMIT ?"
        )
        .bind(limit)
        .fetch_all(&**self.pool)
        .await?;
        
        let mut messages = Vec::new();
        for entity in entities {
            messages.push(entity.try_into()?);
        }
        
        Ok(messages)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageStats {
    pub total_count: i64,
    pub total_tokens: i64,
    pub avg_response_time: Option<f32>,
    pub user_messages: i64,
    pub assistant_messages: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelUsage {
    pub model: String,
    pub usage_count: i64,
    pub total_tokens: i64,
    pub avg_response_time: Option<f32>,
}

impl Repository for MessageRepository {
    type Entity = Message;
    type Id = Uuid;
    
    async fn create(&self, message: &Message) -> Result<Uuid> {
        let entity = MessageEntity::from(message.clone());
        
        sqlx::query(
            r#"
            INSERT INTO messages (
                id, session_id, role, content, model, tokens_used, response_time,
                created_at, metadata, parent_message_id, is_edited, edit_count
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&entity.id)
        .bind(&entity.session_id)
        .bind(&entity.role)
        .bind(&entity.content)
        .bind(&entity.model)
        .bind(&entity.tokens_used)
        .bind(&entity.response_time)
        .bind(&entity.created_at)
        .bind(&entity.metadata)
        .bind(&entity.parent_message_id)
        .bind(&entity.is_edited)
        .bind(&entity.edit_count)
        .execute(&**self.pool)
        .await?;
        
        Ok(message.id)
    }
    
    async fn find_by_id(&self, id: &Uuid) -> Result<Option<Message>> {
        let entity = sqlx::query_as::<_, MessageEntity>(
            "SELECT * FROM messages WHERE id = ?"
        )
        .bind(id.to_string())
        .fetch_optional(&**self.pool)
        .await?;
        
        match entity {
            Some(entity) => Ok(Some(entity.try_into()?)),
            None => Ok(None),
        }
    }
    
    async fn update(&self, message: &Message) -> Result<()> {
        let entity = MessageEntity::from(message.clone());
        
        sqlx::query(
            r#"
            UPDATE messages 
            SET role = ?, content = ?, model = ?, tokens_used = ?, response_time = ?,
                metadata = ?, parent_message_id = ?, is_edited = ?, edit_count = ?
            WHERE id = ?
            "#
        )
        .bind(&entity.role)
        .bind(&entity.content)
        .bind(&entity.model)
        .bind(&entity.tokens_used)
        .bind(&entity.response_time)
        .bind(&entity.metadata)
        .bind(&entity.parent_message_id)
        .bind(&entity.is_edited)
        .bind(&entity.edit_count)
        .bind(&entity.id)
        .execute(&**self.pool)
        .await?;
        
        Ok(())
    }
    
    async fn delete(&self, id: &Uuid) -> Result<()> {
        sqlx::query("DELETE FROM messages WHERE id = ?")
            .bind(id.to_string())
            .execute(&**self.pool)
            .await?;
        
        Ok(())
    }
}