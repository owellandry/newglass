use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Row};
use uuid::Uuid;

use crate::repositories::{DbPool, Repository};

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct TranscriptEntity {
    pub id: String,
    pub session_id: String,
    pub speaker: String,
    pub text: String,
    pub confidence: Option<f32>,
    pub audio_source: String, // "user" or "system"
    pub language: Option<String>,
    pub created_at: DateTime<Utc>,
    pub audio_duration: Option<f32>, // Duration in seconds
    pub word_count: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transcript {
    pub id: Uuid,
    pub session_id: Uuid,
    pub speaker: String,
    pub text: String,
    pub confidence: Option<f32>,
    pub audio_source: AudioSource,
    pub language: Option<String>,
    pub created_at: DateTime<Utc>,
    pub audio_duration: Option<f32>,
    pub word_count: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AudioSource {
    User,
    System,
}

impl std::fmt::Display for AudioSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AudioSource::User => write!(f, "user"),
            AudioSource::System => write!(f, "system"),
        }
    }
}

impl std::str::FromStr for AudioSource {
    type Err = anyhow::Error;
    
    fn from_str(s: &str) -> Result<Self> {
        match s.to_lowercase().as_str() {
            "user" => Ok(AudioSource::User),
            "system" => Ok(AudioSource::System),
            _ => Err(anyhow::anyhow!("Invalid audio source: {}", s)),
        }
    }
}

impl From<Transcript> for TranscriptEntity {
    fn from(transcript: Transcript) -> Self {
        Self {
            id: transcript.id.to_string(),
            session_id: transcript.session_id.to_string(),
            speaker: transcript.speaker,
            text: transcript.text,
            confidence: transcript.confidence,
            audio_source: transcript.audio_source.to_string(),
            language: transcript.language,
            created_at: transcript.created_at,
            audio_duration: transcript.audio_duration,
            word_count: transcript.word_count,
        }
    }
}

impl TryFrom<TranscriptEntity> for Transcript {
    type Error = anyhow::Error;
    
    fn try_from(entity: TranscriptEntity) -> Result<Self> {
        Ok(Self {
            id: Uuid::parse_str(&entity.id)?,
            session_id: Uuid::parse_str(&entity.session_id)?,
            speaker: entity.speaker,
            text: entity.text,
            confidence: entity.confidence,
            audio_source: entity.audio_source.parse()?,
            language: entity.language,
            created_at: entity.created_at,
            audio_duration: entity.audio_duration,
            word_count: entity.word_count,
        })
    }
}

pub struct TranscriptRepository {
    pool: DbPool,
}

impl TranscriptRepository {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }
    
    pub async fn find_by_session_id(&self, session_id: Uuid) -> Result<Vec<Transcript>> {
        let entities = sqlx::query_as::<_, TranscriptEntity>(
            "SELECT * FROM transcripts WHERE session_id = ? ORDER BY created_at ASC"
        )
        .bind(session_id.to_string())
        .fetch_all(&*self.pool)
        .await?;
        
        let mut transcripts = Vec::new();
        for entity in entities {
            transcripts.push(entity.try_into()?);
        }
        
        Ok(transcripts)
    }
    
    pub async fn find_by_session_and_source(
        &self, 
        session_id: Uuid, 
        audio_source: AudioSource
    ) -> Result<Vec<Transcript>> {
        let entities = sqlx::query_as::<_, TranscriptEntity>(
            "SELECT * FROM transcripts WHERE session_id = ? AND audio_source = ? ORDER BY created_at ASC"
        )
        .bind(session_id.to_string())
        .bind(audio_source.to_string())
        .fetch_all(&*self.pool)
        .await?;
        
        let mut transcripts = Vec::new();
        for entity in entities {
            transcripts.push(entity.try_into()?);
        }
        
        Ok(transcripts)
    }
    
    pub async fn find_recent(&self, limit: i64) -> Result<Vec<Transcript>> {
        let entities = sqlx::query_as::<_, TranscriptEntity>(
            "SELECT * FROM transcripts ORDER BY created_at DESC LIMIT ?"
        )
        .bind(limit)
        .fetch_all(&*self.pool)
        .await?;
        
        let mut transcripts = Vec::new();
        for entity in entities {
            transcripts.push(entity.try_into()?);
        }
        
        Ok(transcripts)
    }
    
    pub async fn find_by_speaker(&self, speaker: &str) -> Result<Vec<Transcript>> {
        let entities = sqlx::query_as::<_, TranscriptEntity>(
            "SELECT * FROM transcripts WHERE speaker = ? ORDER BY created_at DESC"
        )
        .bind(speaker)
        .fetch_all(&*self.pool)
        .await?;
        
        let mut transcripts = Vec::new();
        for entity in entities {
            transcripts.push(entity.try_into()?);
        }
        
        Ok(transcripts)
    }
    
    pub async fn search_text(&self, query: &str) -> Result<Vec<Transcript>> {
        let search_query = format!("%{}%", query);
        let entities = sqlx::query_as::<_, TranscriptEntity>(
            "SELECT * FROM transcripts WHERE text LIKE ? ORDER BY created_at DESC"
        )
        .bind(search_query)
        .fetch_all(&*self.pool)
        .await?;
        
        let mut transcripts = Vec::new();
        for entity in entities {
            transcripts.push(entity.try_into()?);
        }
        
        Ok(transcripts)
    }
    
    pub async fn get_session_stats(&self, session_id: Uuid) -> Result<TranscriptStats> {
        let row = sqlx::query(
            r#"
            SELECT 
                COUNT(*) as total_count,
                SUM(word_count) as total_words,
                SUM(audio_duration) as total_duration,
                AVG(confidence) as avg_confidence
            FROM transcripts 
            WHERE session_id = ?
            "#
        )
        .bind(session_id.to_string())
        .fetch_one(&*self.pool)
        .await?;
        
        Ok(TranscriptStats {
            total_count: row.get("total_count"),
            total_words: row.get::<Option<i64>, _>("total_words").unwrap_or(0),
            total_duration: row.get::<Option<f64>, _>("total_duration").unwrap_or(0.0) as f32,
            avg_confidence: row.get::<Option<f64>, _>("avg_confidence").map(|v| v as f32),
        })
    }
    
    pub async fn cleanup_old_transcripts(&self, days: i64) -> Result<u64> {
        let cutoff_date = Utc::now() - chrono::Duration::days(days);
        
        let result = sqlx::query(
            "DELETE FROM transcripts WHERE created_at < ?"
        )
        .bind(cutoff_date)
        .execute(&*self.pool)
        .await?;
        
        Ok(result.rows_affected())
    }
    
    pub async fn get_conversation_flow(&self, session_id: Uuid) -> Result<Vec<ConversationTurn>> {
        let entities = sqlx::query_as::<_, TranscriptEntity>(
            "SELECT * FROM transcripts WHERE session_id = ? ORDER BY created_at ASC"
        )
        .bind(session_id.to_string())
        .fetch_all(&*self.pool)
        .await?;
        
        let mut turns = Vec::new();
        for entity in entities {
            let transcript: Transcript = entity.try_into()?;
            turns.push(ConversationTurn {
                speaker: transcript.speaker,
                text: transcript.text,
                timestamp: transcript.created_at,
                audio_source: transcript.audio_source,
                confidence: transcript.confidence,
            });
        }
        
        Ok(turns)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptStats {
    pub total_count: i64,
    pub total_words: i64,
    pub total_duration: f32,
    pub avg_confidence: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationTurn {
    pub speaker: String,
    pub text: String,
    pub timestamp: DateTime<Utc>,
    pub audio_source: AudioSource,
    pub confidence: Option<f32>,
}

impl Repository for TranscriptRepository {
    type Entity = Transcript;
    type Id = Uuid;
    
    async fn create(&self, transcript: &Transcript) -> Result<Uuid> {
        let entity = TranscriptEntity::from(transcript.clone());
        
        sqlx::query(
            r#"
            INSERT INTO transcripts (
                id, session_id, speaker, text, confidence, audio_source, 
                language, created_at, audio_duration, word_count
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&entity.id)
        .bind(&entity.session_id)
        .bind(&entity.speaker)
        .bind(&entity.text)
        .bind(&entity.confidence)
        .bind(&entity.audio_source)
        .bind(&entity.language)
        .bind(&entity.created_at)
        .bind(&entity.audio_duration)
        .bind(&entity.word_count)
        .execute(&*self.pool)
        .await?;
        
        Ok(transcript.id)
    }
    
    async fn find_by_id(&self, id: &Uuid) -> Result<Option<Transcript>> {
        let entity = sqlx::query_as::<_, TranscriptEntity>(
            "SELECT * FROM transcripts WHERE id = ?"
        )
        .bind(id.to_string())
        .fetch_optional(&*self.pool)
        .await?;
        
        match entity {
            Some(entity) => Ok(Some(entity.try_into()?)),
            None => Ok(None),
        }
    }
    
    async fn update(&self, transcript: &Transcript) -> Result<()> {
        let entity = TranscriptEntity::from(transcript.clone());
        
        sqlx::query(
            r#"
            UPDATE transcripts 
            SET speaker = ?, text = ?, confidence = ?, audio_source = ?, 
                language = ?, audio_duration = ?, word_count = ?
            WHERE id = ?
            "#
        )
        .bind(&entity.speaker)
        .bind(&entity.text)
        .bind(&entity.confidence)
        .bind(&entity.audio_source)
        .bind(&entity.language)
        .bind(&entity.audio_duration)
        .bind(&entity.word_count)
        .bind(&entity.id)
        .execute(&*self.pool)
        .await?;
        
        Ok(())
    }
    
    async fn delete(&self, id: &Uuid) -> Result<()> {
        sqlx::query("DELETE FROM transcripts WHERE id = ?")
            .bind(id.to_string())
            .execute(&*self.pool)
            .await?;
        
        Ok(())
    }
}