mod config;
mod core;
mod services;
mod repositories;
mod api;
mod audio;

use anyhow::Result;
use clap::{Arg, Command};
use std::env;
use tokio;
use tracing::{info, error, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, Layer};

use crate::config::Config;
use crate::core::app::App;

#[tokio::main]
async fn main() -> Result<()> {
    // Parse command line arguments
    let matches = Command::new("newglass")
        .version(env!("CARGO_PKG_VERSION"))
        .about("NewGlass - AI-powered conversation assistant")
        .arg(
            Arg::new("config")
                .short('c')
                .long("config")
                .value_name("FILE")
                .help("Sets a custom config file")
        )
        .arg(
            Arg::new("port")
                .short('p')
                .long("port")
                .value_name("PORT")
                .help("Sets the server port")
        )
        .arg(
            Arg::new("host")
                .short('h')
                .long("host")
                .value_name("HOST")
                .help("Sets the server host")
        )
        .arg(
            Arg::new("log-level")
                .short('l')
                .long("log-level")
                .value_name("LEVEL")
                .help("Sets the log level (trace, debug, info, warn, error)")
        )
        .arg(
            Arg::new("dev")
                .long("dev")
                .help("Run in development mode")
                .action(clap::ArgAction::SetTrue)
        )
        .arg(
            Arg::new("prod")
                .long("prod")
                .help("Run in production mode")
                .action(clap::ArgAction::SetTrue)
        )
        .get_matches();

    // Load configuration
    let mut config = if matches.get_flag("dev") {
        Config::development()
    } else if matches.get_flag("prod") {
        Config::production()
    } else {
        Config::load()?
    };

    // Apply command line overrides
    if let Some(port) = matches.get_one::<String>("port") {
        if let Ok(port_num) = port.parse::<u16>() {
            config.server.port = port_num;
        }
    }

    if let Some(host) = matches.get_one::<String>("host") {
        config.server.host = host.clone();
    }

    if let Some(log_level) = matches.get_one::<String>("log-level") {
        config.logging.level = log_level.clone();
    }

    // Apply environment variable overrides
    config.apply_env_overrides();

    // Validate configuration
    if let Err(e) = config.validate() {
        eprintln!("Configuration error: {}", e);
        std::process::exit(1);
    }

    // Initialize logging
    init_logging(&config)?;

    info!("Starting NewGlass v{}", env!("CARGO_PKG_VERSION"));
    info!("Configuration loaded successfully");

    // Check for required environment variables
    if config.openrouter.api_key.is_empty() {
        error!("OPENROUTER_API_KEY environment variable is required");
        eprintln!("Error: OPENROUTER_API_KEY environment variable is required");
        eprintln!("Please set your OpenRouter API key:");
        eprintln!("  export OPENROUTER_API_KEY=your_api_key_here");
        std::process::exit(1);
    }

    // Create and run the application
    match App::new(config).await {
        Ok(app) => {
            info!("Application initialized successfully");
            
            // Setup graceful shutdown
            let shutdown_signal = setup_shutdown_handler();
            
            // Run the application
            tokio::select! {
                result = app.run() => {
                    match result {
                        Ok(_) => info!("Application finished successfully"),
                        Err(e) => {
                            error!("Application error: {}", e);
                            std::process::exit(1);
                        }
                    }
                }
                _ = shutdown_signal => {
                    info!("Received shutdown signal, stopping application...");
                }
            }
        }
        Err(e) => {
            error!("Failed to initialize application: {}", e);
            eprintln!("Failed to start NewGlass: {}", e);
            std::process::exit(1);
        }
    }

    info!("NewGlass shutdown complete");
    Ok(())
}

/// Initialize logging based on configuration
fn init_logging(config: &Config) -> Result<()> {
    let log_level = match config.logging.level.to_lowercase().as_str() {
        "trace" => tracing::Level::TRACE,
        "debug" => tracing::Level::DEBUG,
        "info" => tracing::Level::INFO,
        "warn" => tracing::Level::WARN,
        "error" => tracing::Level::ERROR,
        _ => {
            warn!("Invalid log level '{}', defaulting to 'info'", config.logging.level);
            tracing::Level::INFO
        }
    };

    let mut layers = Vec::new();

    // Console output
    if config.logging.console_output {
        if config.logging.json_format {
            let console_layer = tracing_subscriber::fmt::layer()
                .json()
                .with_target(true)
                .with_thread_ids(true)
                .with_filter(tracing_subscriber::filter::LevelFilter::from_level(log_level));
            layers.push(console_layer.boxed());
        } else {
            let console_layer = tracing_subscriber::fmt::layer()
                .pretty()
                .with_target(true)
                .with_thread_ids(true)
                .with_filter(tracing_subscriber::filter::LevelFilter::from_level(log_level));
            layers.push(console_layer.boxed());
        }
    }

    // File output
    if let Some(file_path) = &config.logging.file_path {
        // Create log directory if it doesn't exist
        if let Some(parent) = file_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(file_path)?;

        let file_layer = tracing_subscriber::fmt::layer()
            .with_writer(file)
            .json()
            .with_target(true)
            .with_thread_ids(true)
            .with_filter(tracing_subscriber::filter::LevelFilter::from_level(log_level));
        layers.push(file_layer.boxed());
    }

    // Initialize the subscriber
    tracing_subscriber::registry()
        .with(layers)
        .init();

    Ok(())
}

/// Setup graceful shutdown handler
async fn setup_shutdown_handler() {
    use tokio::signal;

    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            info!("Received Ctrl+C signal");
        },
        _ = terminate => {
            info!("Received terminate signal");
        },
    }
}

/// Print startup banner
fn print_banner() {
    println!(r#"
 ███╗   ██╗███████╗██╗    ██╗ ██████╗ ██╗      █████╗ ███████╗███████╗
 ████╗  ██║██╔════╝██║    ██║██╔════╝ ██║     ██╔══██╗██╔════╝██╔════╝
 ██╔██╗ ██║█████╗  ██║ █╗ ██║██║  ███╗██║     ███████║███████╗███████╗
 ██║╚██╗██║██╔══╝  ██║███╗██║██║   ██║██║     ██╔══██║╚════██║╚════██║
 ██║ ╚████║███████╗╚███╔███╔╝╚██████╔╝███████╗██║  ██║███████║███████║
 ╚═╝  ╚═══╝╚══════╝ ╚══╝╚══╝  ╚═════╝ ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝
                                                                        
"#);
    println!("NewGlass v{}", env!("CARGO_PKG_VERSION"));
    println!("AI-powered conversation assistant\n");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_loading() {
        let config = Config::default();
        assert!(!config.openrouter.base_url.is_empty());
        assert!(config.server.port > 0);
    }

    #[test]
    fn test_config_validation() {
        let mut config = Config::default();
        config.openrouter.api_key = "test_key".to_string();
        assert!(config.validate().is_ok());

        config.openrouter.api_key = String::new();
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_config_builder() {
        let config = crate::config::ConfigBuilder::new()
            .with_database_url("sqlite::memory:".to_string())
            .with_openrouter_api_key("test_key".to_string())
            .with_server_port(8080)
            .build();

        assert_eq!(config.database.url, "sqlite::memory:");
        assert_eq!(config.openrouter.api_key, "test_key");
        assert_eq!(config.server.port, 8080);
    }
}