# NewGlass

A fast, lightweight AI-powered conversation assistant built with Rust. NewGlass provides real-time audio transcription, intelligent chat responses, and conversation analysis through a modern web interface.

## Features

- **Real-time Audio Processing**: Capture and process both microphone and system audio
- **Speech-to-Text**: High-quality transcription using OpenRouter's Whisper models
- **AI Chat**: Intelligent conversation using Claude, GPT, and other leading models
- **Conversation Analysis**: Automatic summarization and topic extraction
- **WebSocket API**: Real-time communication for responsive user experience
- **Session Management**: Organize conversations and transcriptions
- **Cross-platform**: Built with Rust for performance and reliability

## Quick Start

### Prerequisites

- Rust 1.70+ (install from [rustup.rs](https://rustup.rs/))
- OpenRouter API key (get one at [openrouter.ai](https://openrouter.ai/))

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/newglass.git
cd newglass
```

2. Set your OpenRouter API key:
```bash
export OPENROUTER_API_KEY=your_api_key_here
```

3. Build and run:
```bash
cargo run
```

The application will start on `http://localhost:3000` by default.

### Development Mode

```bash
cargo run -- --dev
```

### Production Mode

```bash
cargo run -- --prod
```

## Configuration

NewGlass uses a TOML configuration file located at `./config/config.toml`. The configuration is automatically created with sensible defaults on first run.

### Environment Variables

- `OPENROUTER_API_KEY`: Your OpenRouter API key (required)
- `DATABASE_URL`: Database connection string (default: `sqlite:./data/newglass.db`)
- `SERVER_HOST`: Server host (default: `127.0.0.1`)
- `SERVER_PORT`: Server port (default: `3000`)
- `LOG_LEVEL`: Logging level (default: `info`)
- `CHAT_MODEL`: Chat model to use (default: `anthropic/claude-3.5-sonnet`)
- `TRANSCRIPTION_MODEL`: Transcription model (default: `openai/whisper-large-v3`)

### Configuration Sections

#### Database
```toml
[database]
url = "sqlite:./data/newglass.db"
max_connections = 10
connection_timeout = 30
auto_migrate = true
```

#### Audio
```toml
[audio]
sample_rate = 44100
channels = 2
buffer_size = 1024
noise_gate_threshold = 0.01
voice_activity_threshold = 0.02
auto_gain_control = true
echo_cancellation = true
```

#### OpenRouter
```toml
[openrouter]
api_key = "your_api_key"
base_url = "https://openrouter.ai/api/v1"
chat_model = "anthropic/claude-3.5-sonnet"
transcription_model = "openai/whisper-large-v3"
max_tokens = 4096
temperature = 0.7
```

## API Documentation

### REST Endpoints

#### Sessions
- `GET /api/sessions` - List all sessions
- `POST /api/sessions` - Create a new session
- `GET /api/sessions/{id}` - Get session details
- `PUT /api/sessions/{id}` - Update session
- `DELETE /api/sessions/{id}` - Delete session
- `POST /api/sessions/{id}/start` - Start session
- `POST /api/sessions/{id}/end` - End session

#### Audio
- `POST /api/audio/start` - Start audio recording
- `POST /api/audio/stop` - Stop audio recording
- `GET /api/audio/status` - Get recording status

#### Transcripts
- `GET /api/transcripts/{session_id}` - Get session transcripts
- `GET /api/transcripts/search` - Search transcripts

#### Messages
- `GET /api/messages/{session_id}` - Get session messages
- `POST /api/messages` - Send a message
- `PUT /api/messages/{id}` - Update message
- `DELETE /api/messages/{id}` - Delete message

#### Summaries
- `GET /api/summaries/{session_id}` - Get session summaries
- `POST /api/summaries/generate` - Generate summary

#### Statistics
- `GET /api/stats/sessions` - Session statistics
- `GET /api/stats/usage` - Usage statistics

### WebSocket API

Connect to `/ws` for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

// Send messages
ws.send(JSON.stringify({
  type: 'start_session',
  data: { session_type: 'conversation' }
}));

// Receive events
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

#### WebSocket Message Types

**Client to Server:**
- `start_session` - Start a new session
- `end_session` - End current session
- `start_audio` - Start audio recording
- `stop_audio` - Stop audio recording
- `send_message` - Send chat message
- `generate_summary` - Generate conversation summary

**Server to Client:**
- `session_started` - Session started
- `session_ended` - Session ended
- `audio_data` - Audio data received
- `transcription` - Transcription result
- `chat_message` - Chat message
- `summary_generated` - Summary generated
- `error` - Error occurred

## Architecture

NewGlass is built with a modular architecture:

```
src/
├── main.rs              # Application entry point
├── config.rs            # Configuration management
├── core/                # Core application logic
│   ├── app.rs          # Main application coordinator
│   ├── events.rs       # Event system
│   ├── session.rs      # Session management
│   └── mod.rs
├── services/            # Business logic services
│   ├── audio.rs        # Audio capture and processing
│   ├── stt.rs          # Speech-to-text service
│   ├── chat.rs         # Chat service
│   ├── summary.rs      # Summary generation
│   ├── openrouter.rs   # OpenRouter API client
│   └── mod.rs
├── repositories/        # Data access layer
│   ├── session.rs      # Session repository
│   ├── transcript.rs   # Transcript repository
│   ├── message.rs      # Message repository
│   └── mod.rs
├── api/                 # Web API layer
│   ├── handlers.rs     # HTTP handlers
│   ├── websocket.rs    # WebSocket handlers
│   ├── routes.rs       # Route definitions
│   ├── middleware.rs   # HTTP middleware
│   └── mod.rs
└── audio/               # Audio processing utilities
    ├── processing.rs   # Audio processing
    ├── formats.rs      # Audio format handling
    ├── utils.rs        # Audio utilities
    └── mod.rs
```

## Development

### Building

```bash
# Debug build
cargo build

# Release build
cargo build --release
```

### Testing

```bash
# Run all tests
cargo test

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test test_name
```

### Linting

```bash
# Check code formatting
cargo fmt --check

# Format code
cargo fmt

# Run clippy
cargo clippy
```

### Database Migrations

Migrations are automatically applied on startup when `auto_migrate` is enabled in the configuration. Manual migration:

```bash
# Run migrations
sqlx migrate run --database-url sqlite:./data/newglass.db
```

## Supported Models

### Chat Models
- `anthropic/claude-3.5-sonnet` (default)
- `anthropic/claude-3-haiku`
- `openai/gpt-4o`
- `openai/gpt-4o-mini`
- `meta-llama/llama-3.1-8b-instruct`
- And many more via OpenRouter

### Transcription Models
- `openai/whisper-large-v3` (default)
- `openai/whisper-large-v2`

## Performance

- **Memory Usage**: ~50MB base memory footprint
- **Audio Latency**: <100ms processing latency
- **Transcription**: Real-time processing with 3-second buffers
- **Database**: SQLite with FTS for fast text search
- **Concurrency**: Async/await with tokio runtime

## Troubleshooting

### Common Issues

1. **Audio not working**: Check audio device permissions and configuration
2. **API errors**: Verify OpenRouter API key and model availability
3. **Database errors**: Ensure write permissions for data directory
4. **WebSocket connection issues**: Check firewall and CORS settings

### Logging

Enable debug logging:
```bash
export LOG_LEVEL=debug
cargo run
```

Logs are written to both console and `./logs/newglass.log` by default.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run `cargo test` and `cargo clippy`
6. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- [OpenRouter](https://openrouter.ai/) for AI model access
- [Rust Audio](https://github.com/RustAudio) community for audio libraries
- [Tokio](https://tokio.rs/) for async runtime
- [Axum](https://github.com/tokio-rs/axum) for web framework