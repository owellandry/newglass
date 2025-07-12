use axum::{
    extract::Request,
    http::{HeaderValue, Method, StatusCode},
    middleware::Next,
    response::Response,
};
use std::time::Instant;
use tracing::{info, warn};

/// Request logging middleware
pub async fn logging_middleware(request: Request, next: Next) -> Response {
    let start = Instant::now();
    let method = request.method().clone();
    let uri = request.uri().clone();
    let user_agent = request
        .headers()
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("unknown")
        .to_string();
    
    let response = next.run(request).await;
    
    let duration = start.elapsed();
    let status = response.status();
    
    info!(
        "{} {} {} - {}ms - {}",
        method,
        uri,
        status.as_u16(),
        duration.as_millis(),
        user_agent
    );
    
    response
}

/// Rate limiting middleware (basic implementation)
pub async fn rate_limit_middleware(request: Request, next: Next) -> Result<Response, StatusCode> {
    // In a real implementation, you would use a proper rate limiting library
    // like tower-governor or implement Redis-based rate limiting
    
    // For now, just pass through
    Ok(next.run(request).await)
}

/// Authentication middleware (placeholder)
pub async fn auth_middleware(request: Request, next: Next) -> Result<Response, StatusCode> {
    // Check for API key or JWT token
    let auth_header = request
        .headers()
        .get("authorization")
        .and_then(|h| h.to_str().ok());
    
    // For development, allow all requests
    // In production, implement proper authentication
    if let Some(_auth) = auth_header {
        // Validate token here
    }
    
    Ok(next.run(request).await)
}

/// CORS middleware (handled by tower-http in main router)
pub fn cors_headers() -> [(String, HeaderValue); 3] {
    [
        ("Access-Control-Allow-Origin".to_string(), HeaderValue::from_static("*")),
        ("Access-Control-Allow-Methods".to_string(), HeaderValue::from_static("GET, POST, PUT, DELETE, OPTIONS")),
        ("Access-Control-Allow-Headers".to_string(), HeaderValue::from_static("Content-Type, Authorization")),
    ]
}

/// Error handling middleware
pub async fn error_handler_middleware(request: Request, next: Next) -> Response {
    let response = next.run(request).await;
    
    // Log errors
    if response.status().is_server_error() {
        warn!("Server error: {}", response.status());
    }
    
    response
}