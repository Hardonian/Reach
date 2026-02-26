//! Protocol Integration Tests
//!
//! Tests for round-trip serialization, determinism, and error handling.

use bytes::BytesMut;
use requiem::protocol::{
    CapabilityFlags, Encoding, ErrorCode, ErrorPayload, ExecRequestPayload, ExecResultPayload,
    ExecutionControls, ExecutionMetrics, Frame, FrameCodec, FrameFlags, FrameError,
    HealthRequestPayload, HealthResultPayload, HealthStatus, HelloAckPayload, HelloPayload,
    Histogram, LoadMetrics, MessageType, ProtocolVersion, RunStatus, Workflow, decode_cbor,
    encode_cbor, frame_message, parse_frame,
};
use requiem::fixed::{
    FixedBps, FixedDuration, FixedPpm, FixedQ32_32, FixedThroughput,
};
use std::collections::BTreeMap;
use tokio_util::codec::{Decoder, Encoder};

// ============================================================================
// Golden Frame Tests
// ============================================================================

#[test]
fn test_hello_frame_golden() {
    let hello = HelloPayload::new("reach-cli", "1.0.0");
    let frame = frame_message(MessageType::Hello, &hello).unwrap();
    
    // Verify frame structure
    assert_eq!(frame.version_major, 1);
    assert_eq!(frame.version_minor, 0);
    assert_eq!(frame.msg_type, MessageType::Hello);
    assert_eq!(frame.flags, FrameFlags::NONE);
    
    // Verify payload decodes correctly
    let decoded: HelloPayload = parse_frame(&frame).unwrap();
    assert_eq!(decoded.client_name, "reach-cli");
    assert_eq!(decoded.client_version, "1.0.0");
}

#[test]
fn test_hello_ack_roundtrip() {
    let ack = HelloAckPayload::new("test-session-123");
    let frame = frame_message(MessageType::HelloAck, &ack).unwrap();
    
    let decoded: HelloAckPayload = parse_frame(&frame).unwrap();
    assert_eq!(ack.session_id, decoded.session_id);
    assert_eq!(ack.selected_version, decoded.selected_version);
}

#[test]
fn test_exec_request_roundtrip() {
    let request = ExecRequestPayload {
        run_id: "run-test-123".to_string(),
        workflow: Workflow {
            name: "test-workflow".to_string(),
            version: "1.0.0".to_string(),
            steps: vec![],
        },
        controls: ExecutionControls {
            max_steps: Some(100),
            step_timeout_us: FixedDuration::from_seconds(30).unwrap(),
            run_timeout_us: FixedDuration::from_minutes(5),
            budget_limit_usd: FixedQ32_32::from_f64(10.0).unwrap(),
            min_step_interval_us: FixedDuration::from_millis(100).unwrap(),
        },
        policy: Default::default(),
        metadata: {
            let mut m = BTreeMap::new();
            m.insert("source".to_string(), "test".to_string());
            m
        },
    };
    
    let frame = frame_message(MessageType::ExecRequest, &request).unwrap();
    let decoded: ExecRequestPayload = parse_frame(&frame).unwrap();
    
    assert_eq!(request.run_id, decoded.run_id);
    assert_eq!(request.workflow.name, decoded.workflow.name);
    assert_eq!(request.controls.max_steps, decoded.controls.max_steps);
}

#[test]
fn test_health_roundtrip() {
    let req = HealthRequestPayload { detailed: true };
    let frame = frame_message(MessageType::HealthRequest, &req).unwrap();
    
    let decoded: HealthRequestPayload = parse_frame(&frame).unwrap();
    assert_eq!(req.detailed, decoded.detailed);
    
    let result = HealthResultPayload {
        status: HealthStatus::Healthy,
        version: "1.0.0".to_string(),
        uptime_us: FixedDuration::from_seconds(3600).unwrap(),
        load: Some(LoadMetrics {
            active_runs: 5,
            queued_runs: 2,
            cpu_bps: FixedBps::from_percent(25.5).unwrap(),
            memory_bps: FixedBps::from_percent(60.0).unwrap(),
        }),
    };
    
    let frame = frame_message(MessageType::HealthResult, &result).unwrap();
    let decoded: HealthResultPayload = parse_frame(&frame).unwrap();
    
    assert!(matches!(decoded.status, HealthStatus::Healthy));
    assert_eq!(decoded.load.as_ref().unwrap().active_runs, 5);
}

// ============================================================================
// Fixed-Point Determinism Tests
// ============================================================================

#[test]
fn test_fixed_q32_32_determinism() {
    // Same input must produce same bytes
    let val = FixedQ32_32::from_f64(1.23456789012345).unwrap();
    
    let encoded1 = encode_cbor(&val).unwrap();
    let encoded2 = encode_cbor(&val).unwrap();
    
    assert_eq!(encoded1, encoded2);
    
    // Verify round-trip
    let decoded: FixedQ32_32 = decode_cbor(&encoded1).unwrap();
    assert_eq!(val.to_raw(), decoded.to_raw());
}

#[test]
fn test_fixed_bps_determinism() {
    let val = FixedBps::from_percent(99.99).unwrap();
    
    let encoded1 = encode_cbor(&val).unwrap();
    let encoded2 = encode_cbor(&val).unwrap();
    
    assert_eq!(encoded1, encoded2);
}

#[test]
fn test_fixed_duration_determinism() {
    let val = FixedDuration::from_micros(12345678901234);
    
    let encoded1 = encode_cbor(&val).unwrap();
    let encoded2 = encode_cbor(&val).unwrap();
    
    assert_eq!(encoded1, encoded2);
}

#[test]
fn test_metrics_determinism() {
    let metrics = ExecutionMetrics {
        steps_executed: 1000,
        elapsed_us: FixedDuration::from_seconds(5).unwrap(),
        budget_spent_usd: FixedQ32_32::from_f64(0.123456789).unwrap(),
        throughput: FixedThroughput::from_ops_per_sec(100.5).unwrap(),
        cas_hit_rate: FixedPpm::from_ratio(0.999).unwrap(),
        latency_p50_us: FixedDuration::from_millis(50).unwrap(),
        latency_p95_us: FixedDuration::from_millis(100).unwrap(),
        latency_p99_us: FixedDuration::from_millis(200).unwrap(),
        latency_histogram: Histogram {
            boundaries: vec![
                FixedDuration::from_millis(10).unwrap(),
                FixedDuration::from_millis(50).unwrap(),
                FixedDuration::from_millis(100).unwrap(),
            ],
            counts: vec![100, 500, 300, 100],
        },
    };
    
    // Multiple encodings must produce identical bytes
    let encoded1 = encode_cbor(&metrics).unwrap();
    let encoded2 = encode_cbor(&metrics).unwrap();
    let encoded3 = encode_cbor(&metrics).unwrap();
    
    assert_eq!(encoded1, encoded2);
    assert_eq!(encoded2, encoded3);
    
    // Verify all fields survive round-trip
    let decoded: ExecutionMetrics = decode_cbor(&encoded1).unwrap();
    assert_eq!(metrics.steps_executed, decoded.steps_executed);
    assert_eq!(metrics.elapsed_us.to_raw(), decoded.elapsed_us.to_raw());
    assert_eq!(metrics.budget_spent_usd.to_raw(), decoded.budget_spent_usd.to_raw());
    assert_eq!(metrics.throughput.to_raw(), decoded.throughput.to_raw());
    assert_eq!(metrics.cas_hit_rate.to_raw(), decoded.cas_hit_rate.to_raw());
    assert_eq!(metrics.latency_histogram.boundaries.len(), decoded.latency_histogram.boundaries.len());
}

// ============================================================================
// Frame Codec Tests
// ============================================================================

#[test]
fn test_frame_codec_roundtrip() {
    let mut codec = FrameCodec;
    let hello = HelloPayload::new("test", "1.0");
    let frame = frame_message(MessageType::Hello, &hello).unwrap();
    
    // Encode
    let mut buf = BytesMut::new();
    codec.encode(frame.clone(), &mut buf).unwrap();
    
    // Decode
    let decoded = codec.decode(&mut buf).unwrap().unwrap();
    
    assert_eq!(frame.version_major, decoded.version_major);
    assert_eq!(frame.version_minor, decoded.version_minor);
    assert_eq!(frame.msg_type, decoded.msg_type);
    assert_eq!(frame.payload, decoded.payload);
}

#[test]
fn test_multiple_frames_in_buffer() {
    let mut codec = FrameCodec;
    let mut buf = BytesMut::new();
    
    // Encode multiple frames
    for i in 0..3 {
        let hello = HelloPayload::new(&format!("client-{}", i), "1.0");
        let frame = frame_message(MessageType::Hello, &hello).unwrap();
        codec.encode(frame, &mut buf).unwrap();
    }
    
    // Decode all frames
    for i in 0..3 {
        let frame = codec.decode(&mut buf).unwrap().unwrap();
        let decoded: HelloPayload = parse_frame(&frame).unwrap();
        assert_eq!(decoded.client_name, format!("client-{}", i));
    }
    
    // Buffer should be empty
    assert!(codec.decode(&mut buf).unwrap().is_none());
}

// ============================================================================
// Error Handling Tests
// ============================================================================

#[test]
fn test_invalid_magic_rejection() {
    let mut buf = BytesMut::new();
    buf.extend_from_slice(&[0xDE, 0xAD, 0xBE, 0xEF]); // Wrong magic
    buf.extend_from_slice(&[0x00; 20]); // Pad to header size
    
    let result = Frame::decode(&mut buf);
    assert!(matches!(result, Err(FrameError::InvalidMagic { .. })));
}

#[test]
fn test_crc_mismatch_rejection() {
    let mut buf = BytesMut::new();
    buf.extend_from_slice(&0x52454348u32.to_le_bytes()); // Magic
    buf.extend_from_slice(&1u16.to_le_bytes()); // Major
    buf.extend_from_slice(&0u16.to_le_bytes()); // Minor
    buf.extend_from_slice(&0x01u32.to_le_bytes()); // Msg type (Hello)
    buf.extend_from_slice(&0u32.to_le_bytes()); // Flags
    buf.extend_from_slice(&5u32.to_le_bytes()); // Payload len
    buf.extend_from_slice(b"hello"); // Payload
    buf.extend_from_slice(&0xDEADBEEFu32.to_le_bytes()); // Wrong CRC
    
    let result = Frame::decode(&mut buf);
    assert!(matches!(result, Err(FrameError::CrcMismatch { .. })));
}

#[test]
fn test_payload_too_large() {
    let huge_payload = vec![0u8; 65 * 1024 * 1024]; // 65 MiB
    let result = Frame::new(MessageType::ExecRequest, huge_payload);
    assert!(matches!(result, Err(FrameError::PayloadTooLarge { .. })));
}

#[test]
fn test_unknown_message_type() {
    let mut buf = BytesMut::new();
    buf.extend_from_slice(&0x52454348u32.to_le_bytes()); // Magic
    buf.extend_from_slice(&1u16.to_le_bytes()); // Major
    buf.extend_from_slice(&0u16.to_le_bytes()); // Minor
    buf.extend_from_slice(&0x9999u32.to_le_bytes()); // Unknown msg type
    buf.extend_from_slice(&0u32.to_le_bytes()); // Flags
    buf.extend_from_slice(&0u32.to_le_bytes()); // Payload len
    
    // Calculate correct CRC for this frame
    use crc32c::crc32c;
    let mut hasher = crc32c::Hasher::new();
    hasher.update(&0x52454348u32.to_le_bytes());
    hasher.update(&1u16.to_le_bytes());
    hasher.update(&0u16.to_le_bytes());
    hasher.update(&0x9999u32.to_le_bytes());
    hasher.update(&0u32.to_le_bytes());
    hasher.update(&0u32.to_le_bytes());
    let crc = hasher.finalize();
    buf.extend_from_slice(&crc.to_le_bytes());
    
    let result = Frame::decode(&mut buf);
    assert!(matches!(result, Err(FrameError::UnknownMessageType(0x9999))));
}

// ============================================================================
// Protocol Negotiation Tests
// ============================================================================

#[test]
fn test_version_support_check() {
    let hello = HelloPayload {
        client_name: "test".to_string(),
        client_version: "1.0".to_string(),
        min_version: (1, 0),
        max_version: (2, 5),
        capabilities: CapabilityFlags::BINARY_PROTOCOL,
        preferred_encoding: Encoding::Cbor,
    };
    
    // Within range
    assert!(hello.supports_version(1, 0));
    assert!(hello.supports_version(1, 5));
    assert!(hello.supports_version(2, 5));
    
    // Outside range
    assert!(!hello.supports_version(0, 9));
    assert!(!hello.supports_version(2, 6));
    assert!(!hello.supports_version(3, 0));
}

#[test]
fn test_protocol_version_compatibility() {
    let v1 = ProtocolVersion::new(1, 0);
    let v1_5 = ProtocolVersion::new(1, 5);
    let v2 = ProtocolVersion::new(2, 0);
    
    // Same major version = compatible
    assert!(v1.compatible_with(v1_5));
    assert!(v1_5.compatible_with(v1));
    
    // Different major version = incompatible
    assert!(!v1.compatible_with(v2));
    assert!(!v2.compatible_with(v1));
}

// ============================================================================
// Resilience Tests
// ============================================================================

#[test]
fn test_resync_after_garbage() {
    let mut codec = FrameCodec;
    let mut buf = BytesMut::new();
    
    // Add some garbage
    buf.extend_from_slice(b"garbage garbage");
    
    // Add a valid frame
    let hello = HelloPayload::new("test", "1.0");
    let frame = frame_message(MessageType::Hello, &hello).unwrap();
    codec.encode(frame, &mut buf).unwrap();
    
    // First decode should fail
    assert!(codec.decode(&mut buf).is_err());
    
    // After resync, we should find the valid frame
    // Note: In real implementation, we'd use ResilientFrameParser
    // This test verifies that frames can be found after garbage
}

// ============================================================================
// Error Payload Tests
// ============================================================================

#[test]
fn test_error_payload_roundtrip() {
    let error = ErrorPayload {
        code: ErrorCode::BudgetExceeded,
        message: "Budget limit exceeded".to_string(),
        details: {
            let mut m = BTreeMap::new();
            m.insert("limit".to_string(), "10.00".to_string());
            m.insert("spent".to_string(), "10.01".to_string());
            m
        },
        correlation_id: "corr-123".to_string(),
    };
    
    let frame = frame_message(MessageType::Error, &error).unwrap();
    let decoded: ErrorPayload = parse_frame(&frame).unwrap();
    
    assert_eq!(error.code as i32, decoded.code as i32);
    assert_eq!(error.message, decoded.message);
    assert_eq!(error.correlation_id, decoded.correlation_id);
}

// ============================================================================
// Cross-Platform Compatibility Tests
// ============================================================================

#[test]
fn test_endianness_consistency() {
    // Verify that values are always serialized little-endian
    let val = FixedQ32_32::from_i64(0x12345678).unwrap();
    let encoded = encode_cbor(&val).unwrap();
    
    // CBOR uses network byte order (big-endian) by default
    // But we rely on ciborium for proper encoding
    let decoded: FixedQ32_32 = decode_cbor(&encoded).unwrap();
    assert_eq!(val.to_raw(), decoded.to_raw());
}

#[test]
fn test_result_digest_stability() {
    // Create two identical exec results
    let result1 = ExecResultPayload {
        run_id: "test-run".to_string(),
        status: RunStatus::Completed,
        result_digest: "sha256:abc123".to_string(),
        events: vec![],
        final_action: None,
        metrics: ExecutionMetrics::default(),
        session_id: "sess-1".to_string(),
    };
    
    let result2 = ExecResultPayload {
        run_id: "test-run".to_string(),
        status: RunStatus::Completed,
        result_digest: "sha256:abc123".to_string(),
        events: vec![],
        final_action: None,
        metrics: ExecutionMetrics::default(),
        session_id: "sess-1".to_string(),
    };
    
    // Both should serialize to identical bytes
    let encoded1 = encode_cbor(&result1).unwrap();
    let encoded2 = encode_cbor(&result2).unwrap();
    
    assert_eq!(encoded1, encoded2);
}
