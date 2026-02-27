# Red Team Expansion - Abuse Cases

> **Version:** 1.2
> **Last Updated:** 2026-02-27

20 additional abuse cases for testing Reach security boundaries. Each includes goal, attack steps, expected behavior, and minimal test.

---

## Protocol Framing Attacks

### 1. Partial Frame Injection

**Goal:** Cause engine to misparse or crash by sending incomplete frames.

**Attack Steps:**
1. Send valid frame header with truncated payload
2. Send frame with payload length > actual data
3. Send frame with payload length = 0 but more data follows

**Expected Safe Behavior:** Engine rejects partial frames, returns ERR_PROTOCOL_FRAME_INVALID

**Minimal Test:**
```
Send: [MAGIC][VERSION=1.0][TYPE=0x01][FLAGS=0][LEN=100][PAYLOAD=50 bytes]
Expect: ERR_PROTOCOL_FRAME_INVALID (payload length mismatch)
```

---

### 2. Version Downgrade Attempt

**Goal:** Force engine to use older protocol version with known issues.

**Attack Steps:**
1. Send Hello with max_version = 0.1
2. Send Hello with unsupported major version
3. Send Hello with version range that excludes 1.0

**Expected Safe Behavior:** Engine rejects incompatible versions, returns ERR_PROTOCOL_VERSION_MISMATCH

**Minimal Test:**
```
Send: Hello{max_version: [0, 1], min_version: [0, 1]}
Expect: HelloAck with selected_version = nil or ERR_PROTOCOL_VERSION_MISMATCH
```

---

### 3. Max Frame Size Exhaustion

**Goal:** Exhaust memory by sending maximum-sized frames.

**Attack Steps:**
1. Send frame with payload length = 64 MiB (max allowed)
2. Send multiple max-sized frames in sequence
3. Send max-sized frame with compression flag but uncompressible data

**Expected Safe Behavior:** Engine enforces per-frame and aggregate limits, returns ERR_RESOURCE_EXHAUSTED or ERR_OOM

**Minimal Test:**
```
Send: Frame with payload_len = 67108864 (64 MiB)
Expect: ERR_RESOURCE_EXHAUSTED or ERR_OOM (if actual allocation fails)
Or: Frame accepted, tracked against memory limits
```

---

### 4. Frame Flag Manipulation

**Goal:** Confuse engine with invalid flag combinations.

**Attack Steps:**
1. Send frame with COMPRESSED flag but uncompressed data
2. Send frame with EOS flag on non-final frame
3. Send frame with reserved flag bits set

**Expected Safe Behavior:** Engine validates flag combinations, returns ERR_PROTOCOL_FRAME_INVALID

**Minimal Test:**
```
Send: Frame with flags = 0xFF (reserved bits set)
Expect: ERR_PROTOCOL_FRAME_INVALID
```

---

### 5. CRC Injection Attack

**Goal:** Bypass integrity checks by forging CRC.

**Attack Steps:**
1. Send valid frame with correct CRC
2. Send frame with CRC = 0
3. Send frame with CRC = all ones

**Expected Safe Behavior:** Engine validates CRC, rejects invalid checksums

**Minimal Test:**
```
Send: Frame with valid header but CRC = 0x00000000
Expect: ERR_PROTOCOL_FRAME_INVALID (CRC mismatch)
```

---

## Workspace Escape Attacks

### 6. Symlink Race (TOCTOU)

**Goal:** Escape workspace via symlink created between check and use.

**Attack Steps:**
1. Create path that passes validation (within workspace)
2. Between check and use, replace with symlink to outside
3. Access path after symlink replacement

**Expected Safe Behavior:** Engine detects symlink changes, returns ERR_SYMLINK_ESCAPE

**Minimal Test:**
```
Create: /workspace/test (valid path)
Race: ln -sf /etc /workspace/test (between check and use)
Expect: ERR_SYMLINK_ESCAPE (TOCTOU protection triggers)
```

---

### 7. Symlink Directory Traversal

**Goal:** Use symlink to traverse outside workspace.

**Attack Steps:**
1. Create symlink in workspace pointing outside
2. Access file through symlink
3. Use relative paths with symlink components

**Expected Safe Behavior:** Engine resolves symlinks, rejects paths outside workspace

**Minimal Test:**
```
Create: /workspace/link -> /home/user
Access: /workspace/link/.bashrc
Expect: ERR_PATH_OUTSIDE_WORKSPACE or ERR_SYMLINK_ESCAPE
```

---

### 8. Windows Reparse Point Exploitation

**Goal:** Escape workspace using Windows reparse points (junction, mount point).

**Attack Steps:**
1. Create junction from workspace to outside
2. Access files through junction
3. Use mount points to traverse

**Expected Safe Behavior:** Engine detects reparse points, rejects traversal

**Minimal Test:**
```
Create: mklink /J workspace\link C:\Windows
Access: workspace\link\system32\config\sam
Expect: ERR_PATH_OUTSIDE_WORKSPACE
```

---

### 9. Path Normalization Bypass

**Goal:** Use unusual path encodings to bypass validation.

**Attack Steps:**
1. Use alternate data streams on Windows
2. Use forward/backward slash mixing
3. Use null bytes in path (if possible)
4. Use unicode normalization differences

**Expected Safe Behavior:** Engine normalizes paths, rejects unusual encodings

**Minimal Test:**
```
Send: path = "..\\..\\etc/passwd" (mixed separators)
Expect: ERR_PATH_TRAVERSAL or normalized to valid path
```

---

### 10. TOCTOU with File Replace

**Goal:** Replace file between check and use.

**Attack Steps:**
1. Check file exists and is safe
2. Replace with malicious file
3. Use the now-replaced file

**Expected Safe Behavior:** Engine detects file changes between check and use

**Minimal Test:**
```
Check: file /workspace/data.json exists (safe JSON)
Race: mv malicious.json /workspace/data.json (between check and use)
Expect: ERR_FILE_CHANGED or re-validation before use
```

---

## CAS Attacks

### 11. CAS Blob Corruption

**Goal:** Corrupt CAS blob to cause integrity failures or wrong results.

**Attack Steps:**
1. Write arbitrary data to CAS storage path
2. Modify existing blob on disk
3. Truncate blob to cause partial read

**Expected Safe Behavior:** CAS detects corruption via BLAKE3 hash, returns ERR_CAS_INTEGRITY

**Minimal Test:**
```
Write: garbage to CAS path
Access: reach cas get <cid>
Expect: ERR_CAS_INTEGRITY (hash mismatch)
```

---

### 12. CAS Eviction Exhaustion

**Goal:** Force CAS to evict all blobs, causing evidence loss.

**Attack Steps:**
1. Fill CAS to capacity with new blobs
2. Trigger eviction (LRU)
3. Request evicted blob

**Expected Safe Behavior:** CAS evicts oldest unused blobs, returns ERR_CAS_EVICTED for missing

**Minimal Test:**
```
Fill: CAS to max capacity (10GB)
Trigger: New write causes eviction
Access: Evicted blob
Expect: ERR_CAS_EVICTED (not ERR_CAS_INTEGRITY)
```

---

### 13. CAS GC Race Condition

**Goal:** Cause GC to collect in-use blob.

**Attack Steps:**
1. Start operation using CAS blob
2. Trigger GC during operation
3. Access blob that was freed

**Expected Safe Behavior:** CAS uses reference counting or pinning, blob remains available

**Minimal Test:**
```
Pin: Blob during operation
Trigger: GC cycle
Access: Pinned blob
Expect: Success (blob not collected)
```

---

### 14. CAS Content Collision

**Goal:** Create hash collision to cause data confusion.

**Attack Steps:**
1. Craft content with same BLAKE3 hash (theoretical)
2. Upload collision content
3. Attempt to retrieve wrong content

**Expected Safe Behavior:** BLAKE3 collision resistance prevents this

**Minimal Test:**
```
Upload: Two different contents
Check: CIDs are different (BLAKE3 collision resistance)
Expect: Different CIDs (impractical to forge)
```

---

## Daemon Lifecycle Attacks

### 15. Daemon Zombie Process

**Goal:** Leave zombie process after daemon exit.

**Attack Steps:**
1. Start daemon
2. Fork process that doesn't exit
3. Kill daemon parent
4. Observe zombie remains

**Expected Safe Behavior:** Proper process cleanup, no zombies

**Minimal Test:**
```
Start: reach daemon
Fork: Child that ignores SIGTERM
Kill: Parent daemon
Check: No zombie processes
Expect: Child cleaned up or orphaned to init
```

---

### 16. Socket/Port Leak

**Goal:** Prevent daemon restart by holding socket.

**Attack Steps:**
1. Start daemon (binds port)
2. Exit without cleanup
3. Try to start again

**Expected Safe Behavior:** Socket properly released on exit, or SO_REUSEADDR enabled

**Minimal Test:**
```
Start: reach daemon (port 7734)
Kill: SIGKILL (no cleanup)
Restart: reach daemon
Expect: Success (socket reused) or ERR_PORT_IN_USE with cleanup guidance
```

---

### 17. Daemon Hang on Exit

**Goal:** Prevent clean daemon shutdown.

**Attack Steps:**
1. Start daemon with running operation
2. Send shutdown signal
3. Observe hang

**Expected Safe Behavior:** Timeout on shutdown, force kill after grace period

**Minimal Test:**
```
Start: reach daemon
Run: Long operation
Signal: SIGTERM
Expect: Graceful shutdown within 30s or SIGKILL after timeout
```

---

### 18. Multiple Daemon Instances

**Goal:** Run multiple daemon instances, cause resource conflicts.

**Attack Steps:**
1. Start first daemon
2. Start second daemon without coordination
3. Observe resource conflicts

**Expected Safe Behavior:** Single instance enforcement via lock file or port

**Minimal Test:**
```
Start: reach daemon (first instance)
Start: reach daemon (second instance)
Expect: ERR_DAEMON_RUNNING or second fails to bind
```

---

## Unicode/Path Attacks

### 19. Unicode Normalization Escape

**Goal:** Use unicode equivalence to escape paths.

**Attack Steps:**
1. Create file with composed unicode (é = U+00E9)
2. Access with decomposed unicode (e + ́ = U+0065 U+0301)
3. Observe if considered same or different

**Expected Safe Behavior:** Paths normalized to NFC, both access same file

**Minimal Test:**
```
Create: /workspace/file with NFC (é)
Access: /workspace/file with NFD (é decomposed)
Expect: Same file accessed (normalized)
```

---

### 20. Windows Short Path Bypass

**Goal:** Use Windows 8.3 short names to bypass validation.

**Attack Steps:**
1. Create long directory name
2. Use short path (PROGRA~1)
3. Access outside workspace

**Expected Safe Behavior:** Short names resolved, workspace check still applies

**Minimal Test:**
```
Create: /workspace/SomeVeryLongDirectoryName
Access: /workspace/PROGRA~1/../workspace/SomeVeryLongDirectoryName
Expect: ERR_PATH_OUTSIDE_WORKSPACE (if escapes) or resolved correctly
```

---

## Summary Table

| ID | Category | Attack | Detection Test |
|----|----------|--------|----------------|
| 1 | Protocol | Partial frame | Send truncated frame |
| 2 | Protocol | Version downgrade | Send incompatible version |
| 3 | Protocol | Max frame exhaustion | Send max-sized frames |
| 4 | Protocol | Flag manipulation | Set reserved flags |
| 5 | Protocol | CRC injection | Send invalid CRC |
| 6 | Workspace | TOCTOU symlink | Race symlink create |
| 7 | Workspace | Symlink traversal | Access via symlink |
| 8 | Workspace | Reparse points | Use Windows junction |
| 9 | Workspace | Path normalization | Mixed separators |
| 10 | Workspace | File replace race | Swap file between check/use |
| 11 | CAS | Blob corruption | Modify CAS on disk |
| 12 | CAS | Eviction exhaustion | Fill and trigger GC |
| 13 | CAS | GC race | GC during pinned access |
| 14 | CAS | Content collision | Test hash uniqueness |
| 15 | Daemon | Zombie process | Fork and kill parent |
| 16 | Daemon | Socket leak | Kill without cleanup |
| 17 | Daemon | Exit hang | Long operation + shutdown |
| 18 | Daemon | Multiple instances | Start two daemons |
| 19 | Unicode | Normalization | NFC vs NFD access |
| 20 | Unicode | Short path | Use 8.3 names |
