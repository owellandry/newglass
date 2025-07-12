pub mod session;
pub mod transcript;
pub mod message;

pub use session::SessionRepository;
pub use transcript::TranscriptRepository;
pub use message::MessageRepository;

use anyhow::Result;
use sqlx::{Pool, Sqlite};
use std::sync::Arc;

/// Database connection pool type
pub type DbPool = Arc<Pool<Sqlite>>;

/// Initialize the database and run migrations
pub async fn initialize_database(database_url: &str) -> Result<DbPool> {
    let pool = sqlx::SqlitePool::connect(database_url).await?;
    
    // Run migrations
    sqlx::migrate!("./migrations").run(&pool).await?;
    
    Ok(Arc::new(pool))
}

/// Common database operations trait
pub trait Repository {
    type Entity;
    type Id;
    
    async fn create(&self, entity: &Self::Entity) -> Result<Self::Id>;
    async fn find_by_id(&self, id: &Self::Id) -> Result<Option<Self::Entity>>;
    async fn update(&self, entity: &Self::Entity) -> Result<()>;
    async fn delete(&self, id: &Self::Id) -> Result<()>;
}