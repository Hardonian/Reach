//! Protocol Message Payloads
//!
//! All payloads use CBOR encoding with deterministic (canonical) representation.
//! This ensures:
//! 1. Same logical message always serializes to same bytes
//! 2. Hash/digest of payload is stable across platforms
//!
//! CBOR canonical rules followed:
//! - Map keys sorted by byte-wise lexical order
//! - Smallest representable encoding used
//! - Floating-point values are avoided (use fixed-point types instead)

use crate::fixed::{FixedBps, FixedDuration, FixedPpm, FixedQ32_32, FixedThroughput};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Capability flags for feature negotiation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct CapabilityFlags(pub u64);

impl CapabilityFlags {
    pub const NONE: Self = Self(0);
    /// Binary protocol supported
    pub const BINARY_PROTOCOL: Self = Self(1 << 0);
    /// CBOR encoding supported
    pub const CBOR_ENCODING: Self = Self(1 << 1);
    /// Compression supported
    pub const COMPRESSION: Self = Self(1 << 2);
    /// Sandbox mode available
    pub const SANDBOX: Self = Self(1 << 3);
    /// LLM integration available
    pub const LLM: Self = Self(1 << 4);
    /// Fixed-point math used
    pub const FIXED_POINT: Self = Self(1 << 5);
    /// Streaming responses supported
    pub const STREAMING: Self = Self(1 << 6);

    pub fn contains(self, other: Self) -> bool {
        self.0 & other.0 != 0
    }

    pub fn insert(&mut self, other: Self) {
        self.0 |= other.0;
    }
}

/// Client hello message (first message from client)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HelloPayload {
    /// Client name (e.g., "reach-cli")
    pub client_name: String,
    /// Client version (semver)
    pub client_version: String,
    /// Minimum supported protocol version (major, minor)
    pub min_version: (u16, u16),
    /// Maximum supported protocol version (major, minor)
    pub max_version: (u16, u16),
    /// Capability flags
    pub capabilities: CapabilityFlags,
    /// Preferred payload encoding
    pub preferred_encoding: Encoding,
}

impl HelloPayload {
    pub fn new(client_name: &str, client_version: &str) -> Self {
        Self {
            client_name: client_name.to_string(),
            client_version: client_version.to_string(),
            min_version: (1, 0),
            max_version: (1, 0),
            capabilities: CapabilityFlags::BINARY_PROTOCOL
                | CapabilityFlags::CBOR_ENCODING
                | CapabilityFlags::FIXED_POINT,
            preferred_encoding: Encoding::Cbor,
        }
    }

    /// Check if this client supports a given protocol version
    pub fn supports_version(&self, major: u16, minor: u16) -> bool {
        let (min_major, min_minor) = self.min_version;
        let (max_major, max_minor) = self.max_version;

        if major < min_major || major > max_major {
            return false;
        }
        if major == min_major && minor < min_minor {
            return false;
        }
        if major == max_major && minor > max_minor {
            return false;
        }
        true
    }
}

/// Server hello acknowledgment
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HelloAckPayload {
    /// Selected protocol version
    pub selected_version: (u16, u16),
    /// Server capabilities
    pub capabilities: CapabilityFlags,
    /// Engine version
    pub engine_version: String,
    /// Contract version
    pub contract_version: String,
    /// Hash algorithm version
    pub hash_version: String,
    /// CAS (Content Addressed Storage) version
    pub cas_version: String,
    /// Server-assigned session ID
    pub session_id: String,
}

impl HelloAckPayload {
    pub fn new(session_id: &str) -> Self {
        Self {
            selected_version: (1, 0),
            capabilities: CapabilityFlags::BINARY_PROTOCOL
                | CapabilityFlags::CBOR_ENCODING
                | CapabilityFlags::FIXED_POINT,
            engine_version: env!("CARGO_PKG_VERSION").to_string(),
            contract_version: "1.0.0".to_string(),
            hash_version: "sha256".to_string(),
            cas_version: "1".to_string(),
            session_id: session_id.to_string(),
        }
    }
}

/// Payload encoding options
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Encoding {
    Cbor,
    Json,
}

/// Execution request payload
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExecRequestPayload {
    /// Unique run ID
    pub run_id: String,
    /// Workflow definition (canonical form)
    pub workflow: Workflow,
    /// Execution controls
    pub controls: ExecutionControls,
    /// Policy configuration
    pub policy: Policy,
    /// Request metadata
    pub metadata: BTreeMap<String, String>,
}

/// Workflow definition (simplified for protocol)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct Workflow {
    /// Workflow name
    pub name: String,
    /// Workflow version
    pub version: String,
    /// Steps to execute
    pub steps: Vec<WorkflowStep>,
}

/// Single workflow step
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WorkflowStep {
    /// Step ID
    pub id: String,
    /// Step type
    pub step_type: StepType,
    /// Step configuration
    pub config: BTreeMap<String, serde_json::Value>,
    /// Dependencies (step IDs that must complete first)
    pub depends_on: Vec<String>,
}

/// Step types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum StepType {
    ToolCall,
    EmitArtifact,
    Decision,
    Pause,
}

/// Execution controls
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExecutionControls {
    /// Maximum number of steps (None = unlimited)
    pub max_steps: Option<u32>,
    /// Per-step timeout in microseconds
    pub step_timeout_us: FixedDuration,
    /// Total run timeout in microseconds
    pub run_timeout_us: FixedDuration,
    /// Budget limit in USD (as Q32.32 for precision)
    pub budget_limit_usd: FixedQ32_32,
    /// Minimum interval between steps in microseconds
    pub min_step_interval_us: FixedDuration,
}

impl Default for ExecutionControls {
    fn default() -> Self {
        Self {
            max_steps: None,
            step_timeout_us: FixedDuration::ZERO,
            run_timeout_us: FixedDuration::ZERO,
            budget_limit_usd: FixedQ32_32::ZERO,
            min_step_interval_us: FixedDuration::ZERO,
        }
    }
}

/// Policy configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct Policy {
    /// Policy rules
    pub rules: Vec<PolicyRule>,
    /// Default decision when no rule matches
    pub default_decision: Decision,
}

/// Single policy rule
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PolicyRule {
    /// Rule name
    pub name: String,
    /// Condition (simplified representation)
    pub condition: PolicyCondition,
    /// Decision if condition matches
    pub decision: Decision,
}

/// Policy condition
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum PolicyCondition {
    Capability { name: String },
    StepLimit { max: u32 },
    BudgetLimit { max_usd: FixedQ32_32 },
    ToolAllowed { tool_name: String },
    And { conditions: Vec<PolicyCondition> },
    Or { conditions: Vec<PolicyCondition> },
}

/// Decision outcome
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Decision {
    Allow,
    Deny { reason: String },
    Prompt,
}

/// Execution result payload
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExecResultPayload {
    /// Run ID
    pub run_id: String,
    /// Final status
    pub status: RunStatus,
    /// Result digest (deterministic hash)
    pub result_digest: String,
    /// Events that occurred during execution
    pub events: Vec<RunEvent>,
    /// Final action (if any)
    pub final_action: Option<Action>,
    /// Execution metrics
    pub metrics: ExecutionMetrics,
    /// Session ID for correlation
    pub session_id: String,
}

/// Run status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RunStatus {
    Completed,
    Paused { reason: String },
    Cancelled { reason: String },
    Failed { reason: String },
}

/// Run event
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RunEvent {
    /// Event ID
    pub event_id: String,
    /// Event type
    pub event_type: String,
    /// Timestamp (microseconds since epoch)
    pub timestamp_us: i64,
    /// Event payload
    pub payload: BTreeMap<String, serde_json::Value>,
}

/// Action
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Action {
    ToolCall {
        step_id: String,
        tool_name: String,
        input: BTreeMap<String, serde_json::Value>,
    },
    EmitArtifact {
        step_id: String,
        artifact_id: String,
    },
    Done,
}

/// Execution metrics with fixed-point values
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct ExecutionMetrics {
    /// Total steps executed
    pub steps_executed: u32,
    /// Total time elapsed in microseconds
    pub elapsed_us: FixedDuration,
    /// Total budget spent (USD as Q32.32)
    pub budget_spent_usd: FixedQ32_32,
    /// Throughput (ops/sec as micro-ops)
    pub throughput: FixedThroughput,
    /// CAS hit rate (ppm)
    pub cas_hit_rate: FixedPpm,
    /// P50 latency in microseconds
    pub latency_p50_us: FixedDuration,
    /// P95 latency in microseconds
    pub latency_p95_us: FixedDuration,
    /// P99 latency in microseconds
    pub latency_p99_us: FixedDuration,
    /// Latency histogram buckets (boundaries in microseconds)
    pub latency_histogram: Histogram,
}

/// Histogram with fixed-point bucket boundaries
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct Histogram {
    /// Bucket boundaries in microseconds (fixed-point, sorted)
    pub boundaries: Vec<FixedDuration>,
    /// Counts per bucket (len = boundaries.len() + 1 for overflow)
    pub counts: Vec<u64>,
}

/// Health check request
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct HealthRequestPayload {
    /// Request detailed metrics
    pub detailed: bool,
}

/// Health check result
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct HealthResultPayload {
    /// Health status
    pub status: HealthStatus,
    /// Engine version
    pub version: String,
    /// Uptime in microseconds
    pub uptime_us: FixedDuration,
    /// Current load metrics (if detailed)
    pub load: Option<LoadMetrics>,
}

/// Health status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum HealthStatus {
    Healthy,
    Degraded { reason: String },
    Unhealthy { reason: String },
}

/// Load metrics
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct LoadMetrics {
    /// Active runs
    pub active_runs: u32,
    /// Queued runs
    pub queued_runs: u32,
    /// CPU utilization (basis points, 0-10000 = 0-100%)
    pub cpu_bps: FixedBps,
    /// Memory utilization (basis points)
    pub memory_bps: FixedBps,
}

/// Error payload
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ErrorPayload {
    /// Error code
    pub code: ErrorCode,
    /// Human-readable message (may be redacted)
    pub message: String,
    /// Detailed error info (structured, safe to log)
    pub details: BTreeMap<String, String>,
    /// Correlation ID for tracing
    pub correlation_id: String,
}

/// Error codes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    // Protocol errors (1xx)
    InvalidMessage = 100,
    UnsupportedVersion = 101,
    EncodingError = 102,
    
    // Execution errors (2xx)
    ExecutionFailed = 200,
    BudgetExceeded = 201,
    Timeout = 202,
    PolicyDenied = 203,
    
    // System errors (3xx)
    InternalError = 300,
    ResourceExhausted = 301,
    ServiceUnavailable = 302,
}

/// Payload encoding/decoding
pub mod encoding {
    use super::*;
    use ciborium::{de::from_reader, ser::into_writer};

    /// Encode payload to CBOR bytes (canonical)
    pub fn encode_cbor<T: Serialize>(value: &T) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        let mut buf = Vec::new();
        into_writer(value, &mut buf)?;
        Ok(buf)
    }

    /// Decode payload from CBOR bytes
    pub fn decode_cbor<T: for<'de> Deserialize<'de>>(bytes: &[u8]) -> Result<T, Box<dyn std::error::Error>> {
        Ok(from_reader(bytes)?)
    }

    /// Encode to JSON (for debugging/fallback)
    pub fn encode_json<T: Serialize>(value: &T) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        Ok(serde_json::to_vec(value)?)
    }

    /// Decode from JSON
    pub fn decode_json<T: for<'de> Deserialize<'de>>(bytes: &[u8]) -> Result<T, Box<dyn std::error::Error>> {
        Ok(serde_json::from_slice(bytes)?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::encoding::*;

    #[test]
    fn test_hello_roundtrip() {
        let hello = HelloPayload::new("reach-cli", "1.0.0");
        let encoded = encode_cbor(&hello).unwrap();
        let decoded: HelloPayload = decode_cbor(&encoded).unwrap();
        assert_eq!(hello.client_name, decoded.client_name);
        assert_eq!(hello.client_version, decoded.client_version);
    }

    #[test]
    fn test_version_support_check() {
        let hello = HelloPayload {
            min_version: (1, 0),
            max_version: (2, 5),
            ..HelloPayload::new("test", "1.0.0")
        };

        assert!(hello.supports_version(1, 0));
        assert!(hello.supports_version(1, 5));
        assert!(hello.supports_version(2, 0));
        assert!(hello.supports_version(2, 5));
        assert!(!hello.supports_version(0, 9));
        assert!(!hello.supports_version(2, 6));
        assert!(!hello.supports_version(3, 0));
    }

    #[test]
    fn test_exec_request_roundtrip() {
        let request = ExecRequestPayload {
            run_id: "run-123".to_string(),
            workflow: Workflow {
                name: "test".to_string(),
                version: "1.0.0".to_string(),
                steps: vec![WorkflowStep {
                    id: "step-1".to_string(),
                    step_type: StepType::ToolCall,
                    config: BTreeMap::new(),
                    depends_on: vec![],
                }],
            },
            controls: ExecutionControls::default(),
            policy: Policy::default(),
            metadata: BTreeMap::new(),
        };

        let encoded = encode_cbor(&request).unwrap();
        let decoded: ExecRequestPayload = decode_cbor(&encoded).unwrap();
        assert_eq!(request.run_id, decoded.run_id);
        assert_eq!(request.workflow.steps.len(), decoded.workflow.steps.len());
    }

    #[test]
    fn test_fixed_point_in_metrics() {
        let metrics = ExecutionMetrics {
            steps_executed: 100,
            elapsed_us: FixedDuration::from_seconds(5).unwrap(),
            budget_spent_usd: FixedQ32_32::from_f64(0.123456789).unwrap(),
            throughput: FixedThroughput::from_ops_per_sec(10.5).unwrap(),
            cas_hit_rate: FixedPpm::from_ratio(0.95).unwrap(),
            latency_p50_us: FixedDuration::from_millis(100).unwrap(),
            latency_p95_us: FixedDuration::from_millis(200).unwrap(),
            latency_p99_us: FixedDuration::from_millis(500).unwrap(),
            latency_histogram: Histogram {
                boundaries: vec![
                    FixedDuration::from_millis(50).unwrap(),
                    FixedDuration::from_millis(100).unwrap(),
                    FixedDuration::from_millis(200).unwrap(),
                ],
                counts: vec![10, 50, 30, 10],
            },
        };

        let encoded = encode_cbor(&metrics).unwrap();
        let decoded: ExecutionMetrics = decode_cbor(&encoded).unwrap();
        
        assert_eq!(metrics.steps_executed, decoded.steps_executed);
        assert_eq!(metrics.elapsed_us.to_raw(), decoded.elapsed_us.to_raw());
        assert_eq!(metrics.budget_spent_usd.to_raw(), decoded.budget_spent_usd.to_raw());
        assert_eq!(metrics.cas_hit_rate.to_raw(), decoded.cas_hit_rate.to_raw());
    }

    #[test]
    fn test_determinism() {
        // Same input should produce same bytes
        let metrics = ExecutionMetrics {
            steps_executed: 42,
            elapsed_us: FixedDuration::from_micros(123456789),
            budget_spent_usd: FixedQ32_32::from_f64(0.12345678901234).unwrap(),
            ..Default::default()
        };

        let encoded1 = encode_cbor(&metrics).unwrap();
        let encoded2 = encode_cbor(&metrics).unwrap();
        assert_eq!(encoded1, encoded2);
    }

    #[test]
    fn test_error_payload() {
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

        let encoded = encode_cbor(&error).unwrap();
        let decoded: ErrorPayload = decode_cbor(&encoded).unwrap();
        assert_eq!(error.code as i32, decoded.code as i32);
        assert_eq!(error.message, decoded.message);
    }
}
