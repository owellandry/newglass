use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Row};
use std::collections::HashMap;
use uuid::Uuid;

use crate::core::session::{Session, SessionStatus, SessionType};
use crate::repositories::{DbPool, Repository};

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct SessionEntity {
    pub id: String,
    pub user_id: Option<String>,
    pub session_type: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub metadata: Option<String>, // JSON string
}

impl From<Session> for SessionEntity {
    fn from(session: Session) -> Self {
        Self {
            id: session.id.to_string(),
            user_id: Some(session.user_id),
            session_type: session.session_type.to_string(),
            status: session.status.to_string(),
            created_at: session.created_at,
            updated_at: session.updated_at,
            metadata: if session.metadata.is_empty() {
                None
            } else {
                Some(serde_json::to_string(&session.metadata).unwrap_or_default())
            },
        }
    }
}

impl TryFrom<SessionEntity> for Session {
    type Error = anyhow::Error;
    
    fn try_from(entity: SessionEntity) -> Result<Self> {
        let metadata = if let Some(metadata_str) = entity.metadata {
            if !metadata_str.is_empty() {
                serde_json::from_str(&metadata_str)?
            } else {
                HashMap::new()
            }
        } else {
            HashMap::new()
        };
        
        Ok(Self {
            id: Uuid::parse_str(&entity.id)?,
            user_id: entity.user_id.unwrap_or_default(),
            session_type: entity.session_type.parse()?,
            status: entity.status.parse()?,
            created_at: entity.created_at,
            updated_at: entity.updated_at,
            metadata,
        })
    }
}

pub struct SessionRepository {
    pool: DbPool,
}

impl SessionRepository {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }
    
    pub async fn find_by_user_id(&self, user_id: &str) -> Result<Vec<Session>> {
        let entities = sqlx::query_as::<_, SessionEntity>(
            "SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC"
        )
        .bind(user_id)
        .fetch_all(&*self.pool)
        .await?;
        
        let mut sessions = Vec::new();
        for entity in entities {
            sessions.push(entity.try_into()?);
        }
        
        Ok(sessions)
    }
    
    pub async fn find_active_sessions(&self) -> Result<Vec<Session>> {
        let entities = sqlx::query_as::<_, SessionEntity>(
            "SELECT * FROM sessions WHERE status = ? ORDER BY updated_at DESC"
        )
        .bind(SessionStatus::Active.to_string())
        .fetch_all(&*self.pool)
        .await?;
        
        let mut sessions = Vec::new();
        for entity in entities {
            sessions.push(entity.try_into()?);
        }
        
        Ok(sessions)
    }
    
    pub async fn find_by_type(&self, session_type: SessionType) -> Result<Vec<Session>> {
        let entities = sqlx::query_as::<_, SessionEntity>(
            "SELECT * FROM sessions WHERE session_type = ? ORDER BY created_at DESC"
        )
        .bind(session_type.to_string())
        .fetch_all(&*self.pool)
        .await?;
        
        let mut sessions = Vec::new();
        for entity in entities {
            sessions.push(entity.try_into()?);
        }
        
        Ok(sessions)
    }
    
    pub async fn update_status(&self, id: Uuid, status: SessionStatus) -> Result<()> {
        sqlx::query(
            "UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?"
        )
        .bind(status.to_string())
        .bind(Utc::now())
        .bind(id.to_string())
        .execute(&*self.pool)
        .await?;
        
        Ok(())
    }
    
    pub async fn update_metadata(&self, id: Uuid, metadata: HashMap<String, serde_json::Value>) -> Result<()> {
        let metadata_json = serde_json::to_string(&metadata)?;
        
        sqlx::query(
            "UPDATE sessions SET metadata = ?, updated_at = ? WHERE id = ?"
        )
        .bind(metadata_json)
        .bind(Utc::now())
        .bind(id.to_string())
        .execute(&*self.pool)
        .await?;
        
        Ok(())
    }
    
    pub async fn cleanup_old_sessions(&self, days: i64) -> Result<u64> {
        let cutoff_date = Utc::now() - chrono::Duration::days(days);
        
        let result = sqlx::query(
            "DELETE FROM sessions WHERE updated_at < ? AND status != ?"
        )
        .bind(cutoff_date)
        .bind(SessionStatus::Active.to_string())
        .execute(&*self.pool)
        .await?;
        
        Ok(result.rows_affected())
    }
    
    pub async fn count_by_status(&self, status: SessionStatus) -> Result<i64> {
        let row = sqlx::query(
            "SELECT COUNT(*) as count FROM sessions WHERE status = ?"
        )
        .bind(status.to_string())
        .fetch_one(&*self.pool)
        .await?;
        
        Ok(row.get("count"))
    }
    
    pub async fn get_session_stats(&self) -> Result<HashMap<String, i64>> {
        let rows = sqlx::query(
            "SELECT status, COUNT(*) as count FROM sessions GROUP BY status"
        )
        .fetch_all(&*self.pool)
        .await?;
        
        let mut stats = HashMap::new();
        for row in rows {
            let status: String = row.get("status");
            let count: i64 = row.get("count");
            stats.insert(status, count);
        }
        
        Ok(stats)
    }
}

impl Repository for SessionRepository {
    type Entity = Session;
    type Id = Uuid;
    
    async fn create(&self, session: &Session) -> Result<Uuid> {
        let entity = SessionEntity::from(session.clone());
        
        sqlx::query(
            r#"
            INSERT INTO sessions (id, user_id, session_type, status, created_at, updated_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&entity.id)
        .bind(&entity.user_id)
        .bind(&entity.session_type)
        .bind(&entity.status)
        .bind(&entity.created_at)
        .bind(&entity.updated_at)
        .bind(&entity.metadata)
        .execute(&*self.pool)
        .await?;
        
        Ok(session.id)
    }
    
    async fn find_by_id(&self, id: &Uuid) -> Result<Option<Session>> {
        let entity = sqlx::query_as::<_, SessionEntity>(
            "SELECT * FROM sessions WHERE id = ?"
        )
        .bind(id.to_string())
        .fetch_optional(&*self.pool)
        .await?;
        
        match entity {
            Some(entity) => Ok(Some(entity.try_into()?)),
            None => Ok(None),
        }
    }
    
    async fn update(&self, session: &Session) -> Result<()> {
        let entity = SessionEntity::from(session.clone());
        
        sqlx::query(
            r#"
            UPDATE sessions 
            SET user_id = ?, session_type = ?, status = ?, updated_at = ?, metadata = ?
            WHERE id = ?
            "#
        )
        .bind(&entity.user_id)
        .bind(&entity.session_type)
        .bind(&entity.status)
        .bind(Utc::now())
        .bind(&entity.metadata)
        .bind(&entity.id)
        .execute(&*self.pool)
        .await?;
        
        Ok(())
    }
    
    async fn delete(&self, id: &Uuid) -> Result<()> {
        sqlx::query("DELETE FROM sessions WHERE id = ?")
            .bind(id.to_string())
            .execute(&*self.pool)
            .await?;
        
        Ok(())
    }
}