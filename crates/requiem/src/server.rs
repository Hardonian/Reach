//! Requiem Server Implementation
//!
//! Provides a streaming protocol server that accepts connections over:
//! - Unix domain sockets (POSIX)
//! - Named pipes (Windows)
//! - TCP sockets (optional, for debugging)

use crate::protocol::{
    CapabilityFlags, ErrorCode, ErrorPayload, ExecRequestPayload, ExecResultPayload,
    Frame, FrameCodec, FrameError, FrameFlags, HealthRequestPayload, HealthResultPayload,
    HealthStatus, HelloAckPayload, HelloPayload, MessageType, ProtocolCapabilities,
    ProtocolError, ProtocolState, ProtocolStats, ProtocolVersion, deserialize_message,
    encode_cbor, frame_message, parse_frame, serialize_message,
};
use bytes::BytesMut;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{Mutex, RwLock};
use tokio_util::codec::{Decoder, Encoder};
use tracing::{debug, error, info, warn};

/// Server configuration
#[derive(Debug, Clone)]
pub struct ServerConfig {
    /// TCP bind address (None = disabled)
    pub tcp_bind: Option<String>,
    /// Named pipe name (Windows) or Unix socket path (POSIX)
    pub socket_path: Option<String>,
    /// Maximum concurrent connections
    pub max_connections: usize,
    /// Connection timeout
    pub connection_timeout_secs: u64,
    /// Maximum request size
    pub max_request_size: usize,
    /// Require CRC verification
    pub require_crc: bool,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            tcp_bind: None, // TCP disabled by default for security
            socket_path: Some("/tmp/requiem.sock".to_string()),
            max_connections: 100,
            connection_timeout_secs: 300,
            max_request_size: 64 * 1024 * 1024,
            require_crc: true,
        }
    }
}

/// Server handle
pub struct Server {
    config: ServerConfig,
    state: Arc<RwLock<ServerState>>,
    stats: Arc<RwLock<ProtocolStats>>,
    shutdown: tokio::sync::broadcast::Sender<()>,
}

#[derive(Debug)]
struct ServerState {
    connections: HashMap<String, ConnectionInfo>,
    next_session_id: u64,
}

#[derive(Debug, Clone)]
struct ConnectionInfo {
    session_id: String,
    client_name: String,
    client_version: String,
    protocol_version: ProtocolVersion,
    connected_at: std::time::Instant,
}

impl Server {
    /// Create a new server with configuration
    pub fn new(config: ServerConfig) -> Self {
        let (shutdown, _) = tokio::sync::broadcast::channel(1);
        Self {
            config,
            state: Arc::new(RwLock::new(ServerState {
                connections: HashMap::new(),
                next_session_id: 1,
            })),
            stats: Arc::new(RwLock::new(ProtocolStats::default())),
            shutdown,
        }
    }

    /// Run the server (blocking)
    pub async fn run(&self) -> Result<(), Box<dyn std::error::Error>> {
        info!("Starting Requiem server");
        info!("Protocol version: {}.{}", 
            crate::protocol::PROTOCOL_VERSION_MAJOR,
            crate::protocol::PROTOCOL_VERSION_MINOR
        );

        let mut handles = vec![];

        // Start TCP listener if configured
        if let Some(bind_addr) = &self.config.tcp_bind {
            let addr = bind_addr.clone();
            let state = self.state.clone();
            let stats = self.stats.clone();
            let shutdown = self.shutdown.subscribe();
            
            info!("Starting TCP listener on {}", addr);
            let handle = tokio::spawn(async move {
                if let Err(e) = run_tcp_server(&addr, state, stats, shutdown).await {
                    error!("TCP server error: {}", e);
                }
            });
            handles.push(handle);
        }

        // TODO: Named pipes and Unix sockets
        #[cfg(unix)]
        if let Some(socket_path) = &self.config.socket_path {
            info!("Starting Unix socket server at {}", socket_path);
            // Unix socket implementation would go here
        }

        #[cfg(windows)]
        if let Some(pipe_name) = &self.config.socket_path {
            info!("Starting named pipe server at {}", pipe_name);
            // Windows named pipe implementation would go here
        }

        // Wait for shutdown signal
        let mut shutdown_rx = self.shutdown.subscribe();
        let _ = shutdown_rx.recv().await;

        info!("Shutting down server");
        
        // Cancel all tasks
        for handle in handles {
            handle.abort();
        }

        Ok(())
    }

    /// Shutdown the server
    pub fn shutdown(&self) {
        let _ = self.shutdown.send(());
    }

    /// Get current statistics
    pub async fn stats(&self) -> ProtocolStats {
        self.stats.read().await.clone()
    }

    /// Get active connections count
    pub async fn active_connections(&self) -> usize {
        self.state.read().await.connections.len()
    }
}

/// Run TCP server
async fn run_tcp_server(
    addr: &str,
    state: Arc<RwLock<ServerState>>,
    stats: Arc<RwLock<ProtocolStats>>,
    mut shutdown: tokio::sync::broadcast::Receiver<()>,
) -> Result<(), Box<dyn std::error::Error>> {
    let listener = TcpListener::bind(addr).await?;
    info!("TCP server listening on {}", addr);

    loop {
        tokio::select! {
            Ok((stream, peer_addr)) = listener.accept() => {
                let state = state.clone();
                let stats = stats.clone();
                
                tokio::spawn(async move {
                    info!("New connection from {}", peer_addr);
                    if let Err(e) = handle_connection(stream, state, stats).await {
                        warn!("Connection from {} error: {}", peer_addr, e);
                    }
                    info!("Connection from {} closed", peer_addr);
                });
            }
            _ = shutdown.recv() => {
                break;
            }
        }
    }

    Ok(())
}

/// Handle a single connection
async fn handle_connection(
    stream: TcpStream,
    state: Arc<RwLock<ServerState>>,
    stats: Arc<RwLock<ProtocolStats>>,
) -> Result<(), ProtocolError> {
    let (mut read_half, mut write_half) = stream.into_split();
    let mut codec = FrameCodec;
    let mut buf = BytesMut::with_capacity(4096);
    let mut connection_state = ProtocolState::Disconnected;
    let mut session_id = String::new();

    loop {
        // Read data
        match read_half.read_buf(&mut buf).await {
            Ok(0) => {
                // Connection closed
                break;
            }
            Ok(n) => {
                let mut s = stats.write().await;
                s.bytes_received += n as u64;
            }
            Err(e) => {
                return Err(ProtocolError::Io(e));
            }
        }

        // Parse frames
        loop {
            match codec.decode(&mut buf) {
                Ok(Some(frame)) => {
                    let mut s = stats.write().await;
                    s.frames_received += 1;
                    drop(s);

                    match handle_frame(
                        frame,
                        &mut connection_state,
                        &mut session_id,
                        &state,
                    ).await {
                        Ok(Some(response)) => {
                            let mut response_buf = BytesMut::new();
                            codec.encode(response, &mut response_buf)?;
                            
                            write_half.write_all(&response_buf).await?;
                            write_half.flush().await?;

                            let mut s = stats.write().await;
                            s.frames_sent += 1;
                            s.bytes_sent += response_buf.len() as u64;
                        }
                        Ok(None) => {
                            // No response needed
                        }
                        Err(e) => {
                            // Send error response
                            let error_frame = create_error_frame(&e, &session_id)?;
                            let mut error_buf = BytesMut::new();
                            codec.encode(error_frame, &mut error_buf)?;
                            
                            write_half.write_all(&error_buf).await?;
                            write_half.flush().await?;

                            // Log error and continue
                            error!("Frame handling error: {}", e);
                        }
                    }
                }
                Ok(None) => {
                    // Need more data
                    break;
                }
                Err(FrameError::InvalidMagic { .. }) => {
                    // Try to resync
                    if let Some(pos) = find_magic(&buf) {
                        if pos > 0 {
                            warn!("Resyncing after invalid magic, skipping {} bytes", pos);
                            buf.advance(pos);
                            let mut s = stats.write().await;
                            s.resync_events += 1;
                            continue;
                        }
                    } else {
                        // No magic found, clear buffer
                        buf.clear();
                    }
                    break;
                }
                Err(FrameError::CrcMismatch { .. }) => {
                    let mut s = stats.write().await;
                    s.crc_errors += 1;
                    warn!("CRC mismatch, dropping frame");
                    // Try to recover by looking for next magic
                    if buf.len() > 4 {
                        buf.advance(1);
                    }
                }
                Err(e) => {
                    return Err(ProtocolError::Frame(e));
                }
            }
        }
    }

    // Clean up connection state
    if !session_id.is_empty() {
        let mut s = state.write().await;
        s.connections.remove(&session_id);
    }

    Ok(())
}

/// Handle a single frame
async fn handle_frame(
    frame: Frame,
    state: &mut ProtocolState,
    session_id: &mut String,
    server_state: &Arc<RwLock<ServerState>>,
) -> Result<Option<Frame>, ProtocolError> {
    match frame.msg_type {
        MessageType::Hello => {
            let hello: HelloPayload = parse_frame(&frame)?;
            debug!("Received hello from {} {}", hello.client_name, hello.client_version);

            // Generate session ID
            let new_session_id = format!("sess-{}", {
                let mut s = server_state.write().await;
                let id = s.next_session_id;
                s.next_session_id += 1;
                id
            });

            // Store connection info
            {
                let mut s = server_state.write().await;
                s.connections.insert(new_session_id.clone(), ConnectionInfo {
                    session_id: new_session_id.clone(),
                    client_name: hello.client_name.clone(),
                    client_version: hello.client_version.clone(),
                    protocol_version: crate::protocol::ProtocolVersion::V1_0,
                    connected_at: std::time::Instant::now(),
                });
            }

            *session_id = new_session_id.clone();
            *state = ProtocolState::Ready;

            // Build response
            let ack = HelloAckPayload::new(&new_session_id);
            let response = frame_message(MessageType::HelloAck, &ack)?;
            
            info!("Session {} established for client {} {}", 
                new_session_id, hello.client_name, hello.client_version);
            
            Ok(Some(response))
        }
        MessageType::ExecRequest => {
            if *state != ProtocolState::Ready {
                return Err(ProtocolError::NoSession);
            }

            let request: ExecRequestPayload = parse_frame(&frame)?;
            debug!("Received exec request for run {}", request.run_id);

            // Process execution (placeholder - actual implementation would call engine)
            let result = process_execution(&request, session_id).await?;
            let response = frame_message(MessageType::ExecResult, &result)?;

            Ok(Some(response))
        }
        MessageType::HealthRequest => {
            let _request: HealthRequestPayload = parse_frame(&frame)?;
            
            let result = HealthResultPayload {
                status: HealthStatus::Healthy,
                version: env!("CARGO_PKG_VERSION").to_string(),
                uptime_us: crate::fixed::FixedDuration::from_micros(0), // TODO: track actual uptime
                load: None,
            };
            
            let response = frame_message(MessageType::HealthResult, &result)?;
            Ok(Some(response))
        }
        _ => {
            // Unexpected message type
            Err(ProtocolError::UnexpectedMessageType {
                expected: MessageType::Hello,
                got: frame.msg_type,
            })
        }
    }
}

/// Process an execution request
async fn process_execution(
    request: &ExecRequestPayload,
    session_id: &str,
) -> Result<ExecResultPayload, ProtocolError> {
    // This is a placeholder - actual implementation would:
    // 1. Validate the workflow
    // 2. Execute through the engine
    // 3. Collect events and results
    // 4. Calculate deterministic result digest
    
    // For now, return a mock success result
    Ok(ExecResultPayload {
        run_id: request.run_id.clone(),
        status: crate::protocol::RunStatus::Completed,
        result_digest: "mock-digest".to_string(), // TODO: actual digest calculation
        events: vec![],
        final_action: Some(crate::protocol::Action::Done),
        metrics: crate::protocol::ExecutionMetrics::default(),
        session_id: session_id.to_string(),
    })
}

/// Create an error response frame
fn create_error_frame(error: &ProtocolError, session_id: &str) -> Result<Frame, ProtocolError> {
    let (code, message) = match error {
        ProtocolError::VersionNegotiationFailed { .. } => {
            (ErrorCode::UnsupportedVersion, "Version negotiation failed".to_string())
        }
        ProtocolError::CapabilityMismatch { .. } => {
            (ErrorCode::UnsupportedVersion, "Capability mismatch".to_string())
        }
        ProtocolError::NoSession => {
            (ErrorCode::InvalidMessage, "No session established".to_string())
        }
        ProtocolError::UnexpectedMessageType { expected, got } => {
            (ErrorCode::InvalidMessage, 
             format!("Expected {:?}, got {:?}", expected, got))
        }
        _ => {
            (ErrorCode::InternalError, "Internal error".to_string())
        }
    };

    let error_payload = ErrorPayload {
        code,
        message,
        details: {
            let mut m = std::collections::BTreeMap::new();
            m.insert("session_id".to_string(), session_id.to_string());
            m
        },
        correlation_id: session_id.to_string(),
    };

    frame_message(MessageType::Error, &error_payload)
}

/// Find magic bytes in buffer
fn find_magic(buf: &BytesMut) -> Option<usize> {
    let magic_bytes = crate::protocol::MAGIC.to_le_bytes();
    buf.windows(4)
        .position(|window| window == magic_bytes)
}

/// Use FrameCodec from frame module
use crate::protocol::frame::{FrameCodec, find_magic as _find_magic};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_server_config_default() {
        let config = ServerConfig::default();
        assert_eq!(config.max_connections, 100);
        assert!(config.tcp_bind.is_none());
    }

    #[tokio::test]
    async fn test_protocol_stats() {
        let stats = Arc::new(RwLock::new(ProtocolStats::default()));
        
        {
            let mut s = stats.write().await;
            s.frames_sent = 10;
            s.frames_received = 20;
        }
        
        {
            let s = stats.read().await;
            assert_eq!(s.frames_sent, 10);
            assert_eq!(s.frames_received, 20);
        }
    }
}
