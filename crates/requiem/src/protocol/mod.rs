//! Reach Binary Protocol (Requiem)
//!
//! This module implements the streaming, length-prefixed binary protocol
//! for communication between Reach CLI and the Requiem engine.
//!
//! ## Protocol Features
//! - Streaming frames with length prefix
//! - CRC32C integrity checking
//! - Protocol version negotiation
//! - Deterministic CBOR encoding
//! - Fixed-point numeric types for cross-platform determinism
//! - Automatic resynchronization on parse errors

pub mod frame;
pub mod message;

pub use frame::{
    Frame, FrameCodec, FrameError, FrameFlags, MessageType, ResilientFrameParser,
    FRAME_OVERHEAD, HEADER_SIZE, MAGIC, MAX_PAYLOAD_BYTES, PROTOCOL_VERSION_MAJOR,
    PROTOCOL_VERSION_MINOR,
};
pub use message::{
    Action, CapabilityFlags, Decision, Encoding, ErrorCode, ErrorPayload, ExecRequestPayload,
    ExecResultPayload, ExecutionControls, ExecutionMetrics, HealthRequestPayload,
    HealthResultPayload, HealthStatus, HelloAckPayload, HelloPayload, Histogram, LoadMetrics,
    Policy, PolicyCondition, PolicyRule, RunEvent, RunStatus, StepType, Workflow, WorkflowStep,
    encoding::{decode_cbor, decode_json, encode_cbor, encode_json},
};

use crate::fixed::{FixedBps, FixedDuration, FixedPpm, FixedQ32_32, FixedThroughput};
use bytes::BytesMut;
use thiserror::Error;

/// Top-level protocol errors
#[derive(Debug, Error)]
pub enum ProtocolError {
    #[error("frame error: {0}")]
    Frame(#[from] FrameError),
    
    #[error("encoding error: {0}")]
    Encoding(String),
    
    #[error("version negotiation failed: client supports {client:?}, server supports {server:?}")]
    VersionNegotiationFailed {
        client: (u16, u16),
        server: (u16, u16),
    },
    
    #[error("capability mismatch: required {required:?}, have {have:?}")]
    CapabilityMismatch {
        required: CapabilityFlags,
        have: CapabilityFlags,
    },
    
    #[error("unexpected message type: expected {expected:?}, got {got:?}")]
    UnexpectedMessageType {
        expected: MessageType,
        got: MessageType,
    },
    
    #[error("session not established")]
    NoSession,
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Protocol state machine
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProtocolState {
    /// Initial state, no connection
    Disconnected,
    /// Hello sent/received, negotiating
    Negotiating,
    /// Connected and ready
    Ready,
    /// Error state
    Error,
}

/// Protocol version
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct ProtocolVersion {
    pub major: u16,
    pub minor: u16,
}

impl ProtocolVersion {
    pub const V1_0: Self = Self { major: 1, minor: 0 };

    pub fn new(major: u16, minor: u16) -> Self {
        Self { major, minor }
    }

    /// Check if this version is compatible with another
    /// Same major version = compatible
    pub fn compatible_with(self, other: Self) -> bool {
        self.major == other.major
    }
}

impl std::fmt::Display for ProtocolVersion {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}.{}", self.major, self.minor)
    }
}

/// Serialize a message to CBOR payload
pub fn serialize_message<T: serde::Serialize>(msg: &T) -> Result<Vec<u8>, ProtocolError> {
    encode_cbor(msg).map_err(|e| ProtocolError::Encoding(e.to_string()))
}

/// Deserialize a message from CBOR payload
pub fn deserialize_message<T: for<'de> serde::Deserialize<'de>>(bytes: &[u8]) -> Result<T, ProtocolError> {
    decode_cbor(bytes).map_err(|e| ProtocolError::Encoding(e.to_string()))
}

/// Build a frame from a message
pub fn frame_message<T: serde::Serialize>(
    msg_type: MessageType,
    msg: &T,
) -> Result<Frame, ProtocolError> {
    let payload = serialize_message(msg)?;
    Frame::new(msg_type, payload).map_err(Into::into)
}

/// Parse a frame payload into a message
pub fn parse_frame<T: for<'de> serde::Deserialize<'de>>(frame: &Frame) -> Result<T, ProtocolError> {
    deserialize_message(frame.payload())
}

/// Protocol statistics (for monitoring)
#[derive(Debug, Clone, Default)]
pub struct ProtocolStats {
    /// Frames sent
    pub frames_sent: u64,
    /// Frames received
    pub frames_received: u64,
    /// Bytes sent
    pub bytes_sent: u64,
    /// Bytes received
    pub bytes_received: u64,
    /// CRC errors
    pub crc_errors: u64,
    /// Resync events
    pub resync_events: u64,
    /// Protocol version used
    pub version: Option<ProtocolVersion>,
}

/// Protocol capabilities for a connection
#[derive(Debug, Clone)]
pub struct ProtocolCapabilities {
    pub version: ProtocolVersion,
    pub encoding: Encoding,
    pub compression: bool,
    pub fixed_point: bool,
}

impl Default for ProtocolCapabilities {
    fn default() -> Self {
        Self {
            version: ProtocolVersion::V1_0,
            encoding: Encoding::Cbor,
            compression: false,
            fixed_point: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_protocol_version() {
        let v1 = ProtocolVersion::new(1, 0);
        let v2 = ProtocolVersion::new(1, 5);
        let v3 = ProtocolVersion::new(2, 0);

        assert!(v1.compatible_with(v2));
        assert!(v2.compatible_with(v1));
        assert!(!v1.compatible_with(v3));
    }

    #[test]
    fn test_frame_message_roundtrip() {
        let hello = HelloPayload::new("test-cli", "1.0.0");
        let frame = frame_message(MessageType::Hello, &hello).unwrap();
        
        assert_eq!(frame.msg_type, MessageType::Hello);
        
        let decoded: HelloPayload = parse_frame(&frame).unwrap();
        assert_eq!(hello.client_name, decoded.client_name);
    }

    #[test]
    fn test_version_ordering() {
        let v1 = ProtocolVersion::new(1, 0);
        let v2 = ProtocolVersion::new(1, 5);
        let v3 = ProtocolVersion::new(2, 0);

        assert!(v1 < v2);
        assert!(v2 < v3);
        assert!(v1 < v3);
    }
}
