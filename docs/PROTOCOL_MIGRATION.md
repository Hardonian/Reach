# Protocol Migration Guide

**From:** JSON over stdin/stdout  
**To:** Binary protocol (Requiem)  
**Status:** Rollout in progress

## Executive Summary

This document describes the migration from the legacy JSON protocol to the new binary protocol (Requiem). The migration is designed to be:

- **Non-breaking:** JSON fallback remains available
- **Gradual:** Per-client opt-in/opt-out
- **Observable:** Full metrics and logging
- **Reversible:** One-command rollback

## Current State

### Legacy JSON Protocol (Stable)
- Transport: stdin/stdout
- Encoding: JSON
- Trigger: Always when binary unavailable

### New Binary Protocol (Default)
- Transport: Unix sockets / Named pipes / TCP
- Encoding: CBOR with fixed-point types
- Trigger: Default for new connections

## Rollout Controls

### Environment Variables

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `REACH_ENGINE_PROTOCOL` | `binary` / `json` / `auto` | `auto` | Protocol selection |
| `REACH_ENGINE_HOST` | `<host>:<port>` | `127.0.0.1:9000` | Binary server address |

### CLI Flags

```bash
# Force binary protocol
reach --engine-protocol=binary ...

# Force JSON protocol (legacy)
reach --engine-protocol=json ...

# Auto-detect (default)
reach --engine-protocol=auto ...
```

### Auto Mode Behavior

```
1. Attempt binary protocol connection
2. If connection fails → fallback to JSON
3. Log fallback reason to diff report
4. Retry binary on next invocation (with backoff)
```

## Migration Steps

### Phase 1: Validate Binary Server (Week 1)

```bash
# 1. Start binary server
requiem serve --bind 127.0.0.1:9000

# 2. Test connectivity
requiem health --address 127.0.0.1:9000

# 3. Verify with single command
REACH_ENGINE_PROTOCOL=binary reach run -- ./my-pack
```

### Phase 2: Enable Auto Mode (Week 2-3)

```bash
# Set default for your shell
export REACH_ENGINE_PROTOCOL=auto

# Run normal workflows
reach run -- ./my-pack

# Check which protocol was used
reach doctor --verbose
```

### Phase 3: Full Cutover (Week 4)

```bash
# Remove JSON fallback (optional)
export REACH_ENGINE_PROTOCOL=binary

# Monitor for errors
reach doctor --watch
```

## Rollback Procedure

### Immediate Rollback (Single Command)

```bash
# Force JSON for current session
export REACH_ENGINE_PROTOCOL=json

# Or for a single command
REACH_ENGINE_PROTOCOL=json reach run -- ./my-pack
```

### Project Rollback

```bash
# Create .env file in project root
echo "REACH_ENGINE_PROTOCOL=json" > .env
```

### Global Rollback

```bash
# Add to shell profile
echo 'export REACH_ENGINE_PROTOCOL=json' >> ~/.bashrc
```

## Troubleshooting

### Binary Connection Failed

**Symptoms:**
```
WARN: Binary protocol connection failed, falling back to JSON
Error: Connection refused (os error 111)
```

**Resolution:**
```bash
# 1. Check if server is running
requiem health --address 127.0.0.1:9000

# 2. Start server if needed
requiem serve --bind 127.0.0.1:9000

# 3. Or use JSON fallback
REACH_ENGINE_PROTOCOL=json reach run -- ./my-pack
```

### CRC Errors

**Symptoms:**
```
ERROR: CRC32C mismatch: expected 0xA1B2C3D4, calculated 0xE5F6A7B8
```

**Resolution:**
```bash
# 1. Check for network issues
# 2. Verify server version matches client
reach doctor

# 3. If persistent, use JSON
REACH_ENGINE_PROTOCOL=json reach run -- ./my-pack
```

### Version Mismatch

**Symptoms:**
```
ERROR: Version negotiation failed: client supports 1.0-1.0, server supports 2.0-2.0
```

**Resolution:**
```bash
# Update client to match server
npm update -g @reach/cli

# Or downgrade server
requiem --version  # Check server version
# (Install matching server version)
```

## Debugging

### Protocol Dump

```bash
# Convert binary dump to JSON
requiem protocol dump --binary capture.bin --out capture.json

# View in human-readable format
cat capture.json | jq '.frames[] | {type: .msg_type, len: .payload.raw_len}'
```

### Frame Validation

```bash
# Validate a captured frame
requiem protocol validate capture.bin
```

### Verbose Logging

```bash
# Enable debug logging
RUST_LOG=debug requiem serve --bind 127.0.0.1:9000

# Or for CLI
REACH_LOG=debug reach run -- ./my-pack
```

## Observability

### Diff Report Fields

Binary protocol adds these fields to diff reports:

```json
{
  "protocol": {
    "protocol_used": "binary",
    "negotiated_version": "1.0",
    "fallback_reason": null,
    "session_id": "sess-abc123",
    "frames_sent": 10,
    "frames_received": 10,
    "crc_errors": 0
  }
}
```

### Metrics

Server exposes these metrics:

| Metric | Type | Description |
|--------|------|-------------|
| `requiem_connections_active` | Gauge | Active connections |
| `requiem_frames_total` | Counter | Total frames processed |
| `requiem_bytes_total` | Counter | Total bytes transferred |
| `requiem_crc_errors_total` | Counter | CRC mismatch count |
| `requiem_resync_events_total` | Counter | Resync events |

### Health Check

```bash
# Check server health
requiem health --address 127.0.0.1:9000

# Output:
# Connected to 127.0.0.1:9000
# Server version: 0.1.0
# Session ID: sess-xyz789
# 
# Health Status: Healthy
# Server Version: 0.1.0
# Uptime: 3600000000 µs
```

## Compatibility Matrix

| Reach CLI | Requiem Server | Protocol Used | Notes |
|-----------|----------------|---------------|-------|
| < 2.0 | Any | JSON only | No binary support |
| >= 2.0 | Not running | JSON (fallback) | Auto-fallback |
| >= 2.0 | >= 1.0 | Binary | Full features |
| >= 2.0 | >= 2.0 | Binary v2 | Need client update |

## Known Limitations

1. **Windows named pipes:** Not yet implemented (use TCP)
2. **Compression:** Not yet implemented (flag reserved)
3. **Streaming:** Partial - server-side complete, client-side pending

## FAQ

### Q: Will JSON protocol be deprecated?

A: No. JSON will remain as a debugging and fallback option indefinitely.

### Q: Can I use binary protocol with remote engines?

A: Yes, use TCP transport with TLS termination:
```bash
requiem serve --bind 0.0.0.0:9000
# With TLS proxy (nginx, envoy, etc.)
```

### Q: How do I verify determinism?

A: Run the same command multiple times and compare result digests:
```bash
for i in {1..10}; do
  REACH_ENGINE_PROTOCOL=binary reach run -- ./my-pack | jq '.result_digest'
done | sort | uniq -c
```

### Q: What if I see different digests between binary and JSON?

A: This is expected during transition. The digest is calculated from the canonical form, not the wire format. If digests differ for identical inputs, file a bug.

## Support

- **Issues:** https://github.com/reach/reach/issues
- **Slack:** #engine-protocol
- **Email:** engine-team@reach.io

## Changelog

| Date | Change |
|------|--------|
| 2026-02-26 | Initial migration guide |
