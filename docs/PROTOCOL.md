# Reach Binary Protocol Specification

**Version:** 1.0  
**Status:** Implemented (Production)  
**Last Updated:** 2026-02-27

## Overview

The Reach Binary Protocol (codenamed "Requiem") is a streaming, length-prefixed binary protocol for communication between the Reach CLI and the Requiem execution engine. It provides:

- **Deterministic serialization** via canonical CBOR encoding
- **Fixed-point numeric types** for cross-platform consistency
- **Streaming frame support** with automatic resynchronization
- **Integrity verification** via CRC32C checksums
- **Version negotiation** for backward compatibility

## Frame Format

All frames use little-endian byte ordering unless otherwise specified.

```
+--------+--------+--------+--------+
| Magic (4 bytes)                   |  "RECH" = 0x52454348
+--------+--------+--------+--------+
| Version Major (2) | Version Minor (2)
+--------+--------+--------+--------+
| Message Type (4 bytes)            |
+--------+--------+--------+--------+
| Flags (4 bytes)                   |
+--------+--------+--------+--------+
| Payload Length (4 bytes)          |
+--------+--------+--------+--------+
| Payload (variable)                |
| ...                               |
+--------+--------+--------+--------+
| CRC32C (4 bytes)                  |
+--------+--------+--------+--------+
```

### Header Fields

| Field | Size | Description |
|-------|------|-------------|
| Magic | 4 bytes | Constant `0x52454348` ("RECH") |
| Version Major | 2 bytes | Protocol major version |
| Version Minor | 2 bytes | Protocol minor version |
| Message Type | 4 bytes | Message type identifier |
| Flags | 4 bytes | Frame flags (see below) |
| Payload Length | 4 bytes | Payload size in bytes (max 64 MiB) |
| Payload | N bytes | CBOR-encoded message |
| CRC32C | 4 bytes | Checksum of all preceding bytes |

### Total Overhead

- Header: 22 bytes
- Footer: 4 bytes
- **Total: 26 bytes per frame**

## Message Types

| Code | Name | Direction | Description |
|------|------|-----------|-------------|
| 0x01 | Hello | C→S | Client initiation |
| 0x02 | HelloAck | S→C | Server acknowledgment |
| 0x10 | ExecRequest | C→S | Execute workflow |
| 0x11 | ExecResult | S→C | Execution result |
| 0x20 | HealthRequest | C→S | Health check |
| 0x21 | HealthResult | S→C | Health status |
| 0xFF | Error | Bidir | Error response |

## Frame Flags

| Bit | Flag | Description |
|-----|------|-------------|
| 0 | COMPRESSED | Payload is zlib-compressed |
| 1 | EOS | End of stream indicator |
| 2 | CORRELATION | Frame has correlation ID |

## Payload Encoding

All payloads use **CBOR** (Concise Binary Object Representation) with canonical encoding rules:

1. **Map keys** are sorted by byte-wise lexical order
2. **Smallest encoding** is always used for values
3. **Floating-point** is avoided in favor of fixed-point types

### Example: Hello Payload (CBOR)

```cbor
{
  "client_name": "reach-cli",
  "client_version": "1.0.0",
  "min_version": [1, 0],
  "max_version": [1, 0],
  "capabilities": 33,
  "preferred_encoding": "cbor"
}
```

## Fixed-Point Numeric Types

To ensure determinism across platforms, the protocol uses fixed-point representations for all numeric values that affect result digests.

### FixedQ32_32 (Signed 64-bit)

- **Format:** Q32.32 (32 integer bits, 32 fractional bits)
- **Range:** ~±2.1 billion
- **Precision:** ~2.3×10⁻¹⁰
- **Use for:** Rates, ratios, currency amounts (USD)

```rust
// Encoding: value * 2^32 as i64
// Example: 1.5 USD -> 6442450944 (0x180000000)
```

### FixedBps (Signed 16-bit)

- **Format:** Basis points (1/100 of 1%)
- **Range:** ±327.68%
- **Use for:** Percentages, utilization rates

```rust
// 100 bps = 1%
// 10000 bps = 100%
```

### FixedPpm (Signed 32-bit)

- **Format:** Parts per million
- **Range:** ±2,147,483 ppm (~214%)
- **Use for:** Hit rates, probabilities

```rust
// 1,000,000 ppm = 100%
// 500,000 ppm = 50%
```

### FixedDuration (Signed 64-bit)

- **Format:** Microseconds
- **Range:** ±292,471 years
- **Use for:** Timeouts, latency measurements, histogram boundaries

```rust
// 1 second = 1,000,000 µs
```

### FixedThroughput (Signed 64-bit)

- **Format:** Micro-operations per second
- **Use for:** Throughput rates

```rust
// 1,000,000 = 1 op/sec
// 2,500,000 = 2.5 ops/sec
```

## Protocol Flow

### Connection Establishment

```
Client                          Server
  |                               |
  |-------- Hello --------------->|
  |                               |
  |<------- HelloAck ------------|
  |                               |
  |-------- ExecRequest --------->|
  |                               |
  |<------- ExecResult -----------|
  |                               |
```

### Hello Negotiation

The client sends a `Hello` message with:
- Client name and version
- Supported protocol version range
- Capability flags

The server responds with `HelloAck` containing:
- Selected protocol version
- Server capabilities
- Session ID for correlation

### Capability Flags

| Bit | Flag | Description |
|-----|------|-------------|
| 0 | BINARY_PROTOCOL | Binary protocol supported |
| 1 | CBOR_ENCODING | CBOR encoding supported |
| 2 | COMPRESSION | Compression supported |
| 3 | SANDBOX | Sandbox mode available |
| 4 | LLM | LLM integration available |
| 5 | FIXED_POINT | Fixed-point math used |
| 6 | STREAMING | Streaming responses supported |

## Error Handling

Errors are returned as `Error` frames with structured payloads:

```json
{
  "code": 201,
  "message": "Budget limit exceeded",
  "details": {
    "limit": "10.00",
    "spent": "10.01"
  },
  "correlation_id": "sess-123"
}
```

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| 100 | InvalidMessage | Malformed message |
| 101 | UnsupportedVersion | Version mismatch |
| 102 | EncodingError | CBOR/JSON error |
| 200 | ExecutionFailed | Runtime failure |
| 201 | BudgetExceeded | Budget limit reached |
| 202 | Timeout | Execution timed out |
| 203 | PolicyDenied | Policy violation |
| 300 | InternalError | Server error |
| 301 | ResourceExhausted | Out of resources |
| 302 | ServiceUnavailable | Service down |

## Resilience

The protocol includes automatic resynchronization:

1. On invalid magic: Skip bytes until next valid magic
2. On CRC mismatch: Discard frame, continue
3. On decode error: Log and continue if possible

Maximum resync attempts: 3 per connection

## Security Considerations

1. **Maximum payload size:** 64 MiB (prevents DoS)
2. **CRC verification:** Required by default (can be disabled for debugging)
3. **No authentication:** This protocol is for local IPC only
4. **No encryption:** Use TLS wrapper for remote connections

## Implementation Notes

### Server Requirements

- Support protocol version 1.0 minimum
- Reject frames with unknown message types
- Enforce payload size limits
- Validate CRC before processing

### Client Requirements

- Start with highest supported version
- Fall back on version mismatch
- Handle `Error` frames gracefully
- Implement resync on parse errors

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-26 | Initial stable release |

## Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| CBOR canonical encoding | ✅ Implemented | All payloads use canonical CBOR |
| Fixed-point numeric types | ✅ Implemented | Q32.32, BPS, PPM, Duration, Throughput |
| Streaming frame support | ✅ Implemented | Length-prefixed frames |
| Automatic resynchronization | ✅ Implemented | Max 3 attempts per connection |
| CRC32C integrity | ✅ Implemented | Required by default |
| Version negotiation | ✅ Implemented | Hello/HelloAck handshake |
| Compression (zlib) | ✅ Implemented | Flag-controlled |
| TLS wrapper | ❌ Not implemented | Use external TLS proxy |
| Authentication | ❌ Not implemented | Local IPC only |

## References

- CBOR: [RFC 8949](https://tools.ietf.org/html/rfc8949)
- CRC32C: [RFC 3385](https://tools.ietf.org/html/rfc3385)
