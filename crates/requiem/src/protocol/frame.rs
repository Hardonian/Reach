//! Binary Protocol Frame Format
//!
//! Frame layout (all little-endian):
//! ```
//! +--------+--------+--------+--------+
//! | Magic (4 bytes)                   |
//! +--------+--------+--------+--------+
//! | Version Major (2) | Version Minor (2)
//! +--------+--------+--------+--------+
//! | Message Type (4 bytes)            |
//! +--------+--------+--------+--------+
//! | Flags (4 bytes)                   |
//! +--------+--------+--------+--------+
//! | Payload Length (4 bytes)          |
//! +--------+--------+--------+--------+
//! | Payload (variable)                |
//! | ...                               |
//! +--------+--------+--------+--------+
//! | CRC32C (4 bytes)                  |
//! +--------+--------+--------+--------+
//! ```
//!
//! Total header: 26 bytes
//! Total frame overhead: 30 bytes

use bytes::{Buf, BufMut, BytesMut};
use crc32c::crc32c;
use serde::{Deserialize, Serialize};
use std::io;
use thiserror::Error;
use tokio_util::codec::{Decoder, Encoder};

/// Magic number: "REACH" in ASCII (0x52454143, but we use 0x52454348 = "RECH")
/// Chosen to be unlikely to appear in random data or text protocols
pub const MAGIC: u32 = 0x52454348;

/// Maximum frame payload size (64 MiB)
/// This prevents memory exhaustion attacks
pub const MAX_PAYLOAD_BYTES: u32 = 64 * 1024 * 1024;

/// Header size: Magic(4) + Version(4) + MsgType(4) + Flags(4) + CorrelationID(4) + PayloadLen(4) = 24
pub const HEADER_SIZE: usize = 24;

/// Frame footer size (CRC) in bytes
pub const FOOTER_SIZE: usize = 4;

/// Total frame overhead
pub const FRAME_OVERHEAD: usize = HEADER_SIZE + FOOTER_SIZE;

/// Pre-allocation limit for untrusted sessions (1 MiB)
pub const MAX_UNTRUSTED_ALLOCATION: u32 = 1024 * 1024;

/// Protocol version (major, minor)
pub const PROTOCOL_VERSION_MAJOR: u16 = 1;
pub const PROTOCOL_VERSION_MINOR: u16 = 0;

/// Frame flags
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct FrameFlags(pub u32);

impl FrameFlags {
    /// No special flags
    pub const NONE: Self = Self(0);
    /// Payload is compressed (zlib)
    pub const COMPRESSED: Self = Self(1 << 0);
    /// End of stream indicator
    pub const EOS: Self = Self(1 << 1);
    /// Request/response correlation
    pub const CORRELATION: Self = Self(1 << 2);

    pub fn contains(self, other: Self) -> bool {
        self.0 & other.0 != 0
    }

    pub fn insert(&mut self, other: Self) {
        self.0 |= other.0;
    }
}

/// Message types for the protocol
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u32)]
pub enum MessageType {
    /// Heartbeat signal (no payload)
    Heartbeat = 0x00,
    /// Client hello (version negotiation)
    Hello = 0x01,
    /// Server hello acknowledgment
    HelloAck = 0x02,
    /// Execution request
    ExecRequest = 0x10,
    /// Execution result
    ExecResult = 0x11,
    /// Health check request
    HealthRequest = 0x20,
    /// Health check result
    HealthResult = 0x21,
    /// Error response
    Error = 0xFF,
}

impl MessageType {
    /// Convert from u32, returns None for unknown values
    pub fn from_u32(value: u32) -> Option<Self> {
        match value {
            0x00 => Some(Self::Heartbeat),
            0x01 => Some(Self::Hello),
            0x02 => Some(Self::HelloAck),
            0x10 => Some(Self::ExecRequest),
            0x11 => Some(Self::ExecResult),
            0x20 => Some(Self::HealthRequest),
            0x21 => Some(Self::HealthResult),
            0xFF => Some(Self::Error),
            _ => None,
        }
    }

    /// Convert to u32
    pub fn to_u32(self) -> u32 {
        self as u32
    }
}

/// Frame parsing/serialization errors
#[derive(Debug, Error)]
pub enum FrameError {
    #[error("invalid magic number: expected {expected:08X}, got {got:08X}")]
    InvalidMagic { expected: u32, got: u32 },
    
    #[error("unsupported protocol version: major={major}, minor={minor}")]
    UnsupportedVersion { major: u16, minor: u16 },
    
    #[error("unknown message type: {0:#08X}")]
    UnknownMessageType(u32),
    
    #[error("payload too large: {size} bytes (max {max})")]
    PayloadTooLarge { size: u32, max: u32 },
    
    #[error("payload length mismatch: header says {expected}, got {actual}")]
    PayloadLengthMismatch { expected: usize, actual: usize },
    
    #[error("CRC32C mismatch: expected {expected:08X}, calculated {calculated:08X}")]
    CrcMismatch { expected: u32, calculated: u32 },
    
    #[error("incomplete frame: need {needed} more bytes")]
    Incomplete { needed: usize },
    
    #[error("IO error: {0}")]
    Io(#[from] io::Error),
}

/// A protocol frame
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Frame {
    pub version_major: u16,
    pub version_minor: u16,
    pub msg_type: MessageType,
    pub flags: FrameFlags,
    pub correlation_id: u32,
    pub payload: Vec<u8>,
}

impl Frame {
    /// Create a new frame with current protocol version
    pub fn new(msg_type: MessageType, payload: Vec<u8>) -> Result<Self, FrameError> {
        let payload_len = payload.len() as u32;
        if payload_len > MAX_PAYLOAD_BYTES {
            return Err(FrameError::PayloadTooLarge {
                size: payload_len,
                max: MAX_PAYLOAD_BYTES,
            });
        }

        Ok(Self {
            version_major: PROTOCOL_VERSION_MAJOR,
            version_minor: PROTOCOL_VERSION_MINOR,
            msg_type,
            flags: FrameFlags::NONE,
            correlation_id: 0,
            payload,
        })
    }

    /// Set correlation ID
    pub fn with_correlation_id(mut self, id: u32) -> Self {
        self.correlation_id = id;
        self
    }

    /// Create a new frame with flags
    pub fn with_flags(mut self, flags: FrameFlags) -> Self {
        self.flags = flags;
        self
    }

    /// Calculate CRC32C over the frame content (excluding the CRC field itself)
    fn calculate_crc(&self) -> u32 {
        let mut hasher = crc32c::Hasher::new();
        
        // Hash magic
        hasher.update(&MAGIC.to_le_bytes());
        // Hash version
        hasher.update(&self.version_major.to_le_bytes());
        hasher.update(&self.version_minor.to_le_bytes());
        // Hash message type
        hasher.update(&self.msg_type.to_u32().to_le_bytes());
        // Hash flags
        hasher.update(&self.flags.0.to_le_bytes());
        // Hash correlation ID
        hasher.update(&self.correlation_id.to_le_bytes());
        // Hash payload length
        hasher.update(&(self.payload.len() as u32).to_le_bytes());
        // Hash payload
        hasher.update(&self.payload);
        
        hasher.finalize()
    }

    /// Serialize frame to bytes
    pub fn encode(&self, dst: &mut BytesMut) -> Result<(), FrameError> {
        let payload_len = self.payload.len();
        let total_len = FRAME_OVERHEAD + payload_len;
        
        dst.reserve(total_len);
        
        // Magic
        dst.put_u32_le(MAGIC);
        // Version
        dst.put_u16_le(self.version_major);
        dst.put_u16_le(self.version_minor);
        // Message type
        dst.put_u32_le(self.msg_type.to_u32());
        // Flags
        dst.put_u32_le(self.flags.0);
        // Correlation ID
        dst.put_u32_le(self.correlation_id);
        // Payload length
        dst.put_u32_le(payload_len as u32);
        // Payload
        dst.extend_from_slice(&self.payload);
        // CRC32C
        let crc = self.calculate_crc();
        dst.put_u32_le(crc);
        
        Ok(())
    }

    /// Decode frame from bytes
    pub fn decode(src: &mut BytesMut) -> Result<Option<Self>, FrameError> {
        // Need at least header size to start parsing
        if src.len() < HEADER_SIZE {
            return Ok(None);
        }

        // Peek at header without consuming
        let mut peek = src.as_ref();
        
        // Check magic
        let magic = peek.get_u32_le();
        if magic != MAGIC {
            return Err(FrameError::InvalidMagic {
                expected: MAGIC,
                got: magic,
            });
        }

        // Parse version
        let version_major = peek.get_u16_le();
        let version_minor = peek.get_u16_le();

        // Parse message type
        let msg_type_raw = peek.get_u32_le();
        let msg_type = MessageType::from_u32(msg_type_raw)
            .ok_or(FrameError::UnknownMessageType(msg_type_raw))?;

        // Parse flags
        let flags = FrameFlags(peek.get_u32_le());

        // Parse correlation ID
        let correlation_id = peek.get_u32_le();

        // Parse payload length
        let payload_len = peek.get_u32_le();

        // Validate payload length
        if payload_len > MAX_PAYLOAD_BYTES {
            return Err(FrameError::PayloadTooLarge {
                size: payload_len,
                max: MAX_PAYLOAD_BYTES,
            });
        }

        // Check if we have the complete frame
        let total_frame_len = FRAME_OVERHEAD + payload_len as usize;
        if src.len() < total_frame_len {
            return Ok(None); // Need more data
        }

        // Now consume the header
        src.advance(HEADER_SIZE);

        // Extract payload with guarded allocation
        // ADVERSARIAL: Cap pre-allocation to prevent memory-based DoS
        let mut payload = Vec::with_capacity(std::cmp::min(payload_len, MAX_UNTRUSTED_ALLOCATION) as usize);
        
        payload.extend_from_slice(&src[..payload_len as usize]);
        src.advance(payload_len as usize);

        // Verify CRC
        let expected_crc = src.get_u32_le();
        
        // Calculate CRC over what we just decoded
        let frame = Self {
            version_major,
            version_minor,
            msg_type,
            flags,
            correlation_id,
            payload,
        };
        
        let calculated_crc = frame.calculate_crc();
        if expected_crc != calculated_crc {
            return Err(FrameError::CrcMismatch {
                expected: expected_crc,
                calculated: calculated_crc,
            });
        }

        Ok(Some(frame))
    }

    /// Get payload as slice
    pub fn payload(&self) -> &[u8] {
        &self.payload
    }
}

/// Tokio codec for framing
pub struct FrameCodec;

impl Decoder for FrameCodec {
    type Item = Frame;
    type Error = FrameError;

    fn decode(&mut self, src: &mut BytesMut) -> Result<Option<Self::Item>, Self::Error> {
        Frame::decode(src)
    }
}

impl Encoder<Frame> for FrameCodec {
    type Error = FrameError;

    fn encode(&mut self, item: Frame, dst: &mut BytesMut) -> Result<(), Self::Error> {
        item.encode(dst)
    }
}

/// Frame parser with recovery capabilities
/// 
/// When a parse error occurs, attempts to resynchronize by scanning for magic bytes
pub struct ResilientFrameParser {
    max_resync_attempts: usize,
}

impl Default for ResilientFrameParser {
    fn default() -> Self {
        Self {
            max_resync_attempts: 3,
        }
    }
}

impl ResilientFrameParser {
    /// Create with custom max resync attempts
    pub fn with_max_resync(max: usize) -> Self {
        Self {
            max_resync_attempts: max,
        }
    }

    /// Parse with automatic resynchronization on error
    /// 
    /// Returns Ok(None) if more data needed
    /// Returns Ok(Some(frame)) on success
    /// Returns Err(_) only on unrecoverable errors
    pub fn parse_resilient(&mut self, src: &mut BytesMut) -> Result<Option<Frame>, FrameError> {
        let mut attempts = 0;

        loop {
            match Frame::decode(src) {
                Ok(frame) => return Ok(frame),
                Err(e) => {
                    attempts += 1;
                    if attempts > self.max_resync_attempts {
                        return Err(e);
                    }

                    // Try to resync by finding next magic bytes
                    if let Some(pos) = find_magic(src) {
                        if pos > 0 {
                            src.advance(pos);
                            continue;
                        }
                    } else {
                        // No magic found, clear buffer if it's getting large
                        if src.len() > 4096 {
                            src.clear();
                        }
                        return Ok(None);
                    }

                    return Err(e);
                }
            }
        }
    }
}

/// Find magic bytes in buffer, returning offset or None
fn find_magic(src: &BytesMut) -> Option<usize> {
    let magic_bytes = MAGIC.to_le_bytes();
    src.windows(4)
        .position(|window| window == magic_bytes)
}

// Compile-time assertions for protocol alignment
const _ASSERT_HEADER_SIZE: () = assert!(HEADER_SIZE == 24, "Header size must be 24 bytes");
const _ASSERT_FRAME_OVERHEAD: () = assert!(FRAME_OVERHEAD == 28, "Frame overhead must be 28 bytes");
const _ASSERT_MAGIC_VALUE: () = assert!(MAGIC == 0x52454348, "Magic must be 'RECH' (0x52454348)");
const _ASSERT_MAX_PAYLOAD: () = assert!(MAX_PAYLOAD_BYTES == 64 * 1024 * 1024, "Max payload must be 64 MiB");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_frame_roundtrip() {
        let payload = b"Hello, World!".to_vec();
        let frame = Frame::new(MessageType::ExecRequest, payload.clone()).unwrap();

        let mut buf = BytesMut::new();
        frame.encode(&mut buf).unwrap();

        let decoded = Frame::decode(&mut buf).unwrap().unwrap();
        assert_eq!(decoded.msg_type, MessageType::ExecRequest);
        assert_eq!(decoded.payload, payload);
        assert_eq!(decoded.version_major, PROTOCOL_VERSION_MAJOR);
        assert_eq!(decoded.version_minor, PROTOCOL_VERSION_MINOR);
    }

    #[test]
    fn test_invalid_magic() {
        let mut buf = BytesMut::new();
        buf.put_u32_le(0xDEADBEEF); // Wrong magic
        buf.put_u16_le(1);
        buf.put_u16_le(0);
        buf.put_u32_le(0x10);
        buf.put_u32_le(0);
        buf.put_u32_le(0);
        buf.put_u32_le(0);

        let result = Frame::decode(&mut buf);
        assert!(matches!(result, Err(FrameError::InvalidMagic { .. })));
    }

    #[test]
    fn test_payload_too_large() {
        let huge_payload = vec![0u8; (MAX_PAYLOAD_BYTES + 1) as usize];
        let result = Frame::new(MessageType::ExecRequest, huge_payload);
        assert!(matches!(result, Err(FrameError::PayloadTooLarge { .. })));
    }

    #[test]
    fn test_unknown_message_type() {
        let mut buf = BytesMut::new();
        buf.put_u32_le(MAGIC);
        buf.put_u16_le(1);
        buf.put_u16_le(0);
        buf.put_u32_le(0x9999); // Unknown type
        buf.put_u32_le(0);
        buf.put_u32_le(0);
        buf.put_u32_le(crc32c(&[]));

        let result = Frame::decode(&mut buf);
        assert!(matches!(result, Err(FrameError::UnknownMessageType(0x9999))));
    }

    #[test]
    fn test_crc_mismatch() {
        let mut buf = BytesMut::new();
        buf.put_u32_le(MAGIC);
        buf.put_u16_le(1);
        buf.put_u16_le(0);
        buf.put_u32_le(0x10);
        buf.put_u32_le(0);
        buf.put_u32_le(5);
        buf.extend_from_slice(b"hello");
        buf.put_u32_le(0xDEADBEEF); // Wrong CRC

        let result = Frame::decode(&mut buf);
        assert!(matches!(result, Err(FrameError::CrcMismatch { .. })));
    }

    #[test]
    fn test_incomplete_frame() {
        let mut buf = BytesMut::new();
        buf.put_u32_le(MAGIC);
        buf.put_u16_le(1);
        // Incomplete...

        let result = Frame::decode(&mut buf).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_message_type_roundtrip() {
        for msg_type in [
            MessageType::Heartbeat,
            MessageType::Hello,
            MessageType::HelloAck,
            MessageType::ExecRequest,
            MessageType::ExecResult,
            MessageType::HealthRequest,
            MessageType::HealthResult,
            MessageType::Error,
        ] {
            let encoded = msg_type.to_u32();
            let decoded = MessageType::from_u32(encoded).unwrap();
            assert_eq!(msg_type, decoded);
        }
    }

    #[test]
    fn test_heartbeat_message_type() {
        // Heartbeat (0x00) must be recognized
        assert_eq!(MessageType::Heartbeat as u32, 0x00);
        assert_eq!(MessageType::from_u32(0x00), Some(MessageType::Heartbeat));
    }

    #[test]
    fn test_find_magic() {
        let mut buf = BytesMut::new();
        buf.extend_from_slice(b"garbage");
        buf.put_u32_le(MAGIC);
        buf.extend_from_slice(b"more");

        let pos = find_magic(&buf).unwrap();
        assert_eq!(pos, 7);
    }

    #[test]
    fn test_find_magic_not_found() {
        let buf = BytesMut::from(&b"no magic here"[..]);
        assert!(find_magic(&buf).is_none());
    }
}
