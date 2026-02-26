//! Requiem - Reach Engine Protocol
//!
//! A streaming, length-prefixed binary protocol for the Reach CLI
//! with deterministic fixed-point math for cross-platform consistency.
//!
//! # Features
//! - **Streaming Protocol**: Length-prefixed frames with CRC32C integrity checking
//! - **Fixed-Point Math**: Deterministic numeric types (Q32.32, basis points, ppm)
//! - **CBOR Encoding**: Canonical serialization for stable digests
//! - **Version Negotiation**: Automatic protocol version selection
//! - **Resilient Parsing**: Automatic resynchronization on parse errors
//!
//! # Quick Start
//! ```rust,no_run
//! use requiem::{Server, ServerConfig};
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     let config = ServerConfig {
//!         tcp_bind: Some("127.0.0.1:9000".to_string()),
//!         ..Default::default()
//!     };
//!     
//!     let server = Server::new(config);
//!     server.run().await
//! }
//! ```

pub mod fixed;
pub mod protocol;
pub mod server;

// Re-export commonly used types
pub use fixed::{
    FixedBps, FixedDuration, FixedPpm, FixedQ32_32, FixedThroughput,
};
pub use protocol::{
    CapabilityFlags, Encoding, ErrorCode, ErrorPayload, ExecRequestPayload, ExecResultPayload,
    ExecutionControls, ExecutionMetrics, Frame, FrameError, FrameFlags, HealthRequestPayload,
    HealthResultPayload, HelloAckPayload, HelloPayload, Histogram, MessageType, ProtocolCapabilities,
    ProtocolError, ProtocolState, ProtocolStats, ProtocolVersion, RunStatus, Workflow,
    decode_cbor, encode_cbor, frame_message, parse_frame,
};
pub use server::{Server, ServerConfig};

/// Protocol version information
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Protocol name
pub const PROTOCOL_NAME: &str = "reach-binary-protocol";

/// Check if the protocol is supported
pub fn is_supported() -> bool {
    true
}

/// Get protocol capabilities
pub fn capabilities() -> ProtocolCapabilities {
    ProtocolCapabilities::default()
}
