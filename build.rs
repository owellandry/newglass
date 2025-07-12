use std::env;
use std::fs;
use std::path::Path;

fn main() {
    // Create necessary directories
    let _out_dir = env::var("OUT_DIR").unwrap();
    let project_root = env::var("CARGO_MANIFEST_DIR").unwrap();
    
    // Create data directory for database
    let data_dir = Path::new(&project_root).join("data");
    if !data_dir.exists() {
        fs::create_dir_all(&data_dir).expect("Failed to create data directory");
    }
    
    // Create logs directory
    let logs_dir = Path::new(&project_root).join("logs");
    if !logs_dir.exists() {
        fs::create_dir_all(&logs_dir).expect("Failed to create logs directory");
    }
    
    // Create config directory
    let config_dir = Path::new(&project_root).join("config");
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).expect("Failed to create config directory");
    }
    
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=migrations/");
    
    // Set build timestamp
    println!("cargo:rustc-env=BUILD_TIMESTAMP={}", chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC"));
    
    // Set git commit hash if available
    if let Ok(output) = std::process::Command::new("git")
        .args(&["rev-parse", "--short", "HEAD"])
        .output()
    {
        if output.status.success() {
            let git_hash = String::from_utf8_lossy(&output.stdout).trim().to_string();
            println!("cargo:rustc-env=GIT_HASH={}", git_hash);
        }
    }
}