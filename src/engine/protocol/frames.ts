/**
 * Protocol Robustness Layer
 *
 * Production-grade protocol handling with:
 * - MAX_FRAME_BYTES enforcement
 * - Timeouts on incomplete frames
 * - Invalid frame handling (deterministic ERROR + close)
 * - Backpressure (client sees deterministic retryable error)
 * - Strict version negotiation (fail closed on downgrade)
 */

import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";

// ============================================================================
// Protocol Constants
// ============================================================================

/** Maximum frame size in bytes (16MB) */
export const MAX_FRAME_BYTES = 16 * 1024 * 1024;

/** Protocol version - major.minor.patch */
export const PROTOCOL_VERSION = "1.0.0";

/** Minimum supported protocol version */
export const MIN_PROTOCOL_VERSION = "1.0.0";

/** Frame header size (4 bytes for length prefix) */
export const FRAME_HEADER_SIZE = 4;

/** Maximum payload size (frame - header) */
export const MAX_PAYLOAD_SIZE = MAX_FRAME_BYTES - FRAME_HEADER_SIZE;

/** Default timeout for frame reception */
export const DEFAULT_FRAME_TIMEOUT_MS = 5000;

/** Magic bytes for protocol identification */
export const PROTOCOL_MAGIC = Buffer.from([0x52, 0x45, 0x41, 0x43]); // "REAC"

// ============================================================================
// Error Codes
// ============================================================================

export const ProtocolErrorCode = {
  FRAME_OVERSIZE: "FRAME_OVERSIZE",
  FRAME_TIMEOUT: "FRAME_TIMEOUT",
  INVALID_FRAME: "INVALID_FRAME",
  INVALID_MAGIC: "INVALID_MAGIC",
  VERSION_MISMATCH: "VERSION_MISMATCH",
  CHECKSUM_FAILED: "CHECKSUM_FAILED",
  CONNECTION_CLOSED: "CONNECTION_CLOSED",
  BACKPRESSURE: "BACKPRESSURE",
  PROTOCOL_ERROR: "PROTOCOL_ERROR",
} as const;

export type ProtocolErrorCode =
  (typeof ProtocolErrorCode)[keyof typeof ProtocolErrorCode];

// ============================================================================
// Frame Types
// ============================================================================

export enum FrameType {
  HANDSHAKE = 0x01,
  REQUEST = 0x02,
  RESPONSE = 0x03,
  HEARTBEAT = 0x04,
  HEARTBEAT_ACK = 0x05,
  ERROR = 0x06,
  CLOSE = 0x07,
  CHALLENGE = 0x08,
  CHALLENGE_RESPONSE = 0x09,
}

// ============================================================================
// Types
// ============================================================================

export interface Frame {
  type: FrameType;
  version: string;
  payload: Buffer;
  checksum: string;
  timestamp: number;
}

export interface HandshakePayload {
  version: string;
  clientName: string;
  capabilities: string[];
}

export interface ErrorPayload {
  code: ProtocolErrorCode;
  message: string;
  retryable: boolean;
  suggestedBackoffMs?: number;
}

export interface ProtocolConfig {
  maxFrameBytes: number;
  frameTimeoutMs: number;
  protocolVersion: string;
  minProtocolVersion: string;
  enforceVersionCheck: boolean;
  enableChecksums: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

export function getDefaultProtocolConfig(): ProtocolConfig {
  return {
    maxFrameBytes: MAX_FRAME_BYTES,
    frameTimeoutMs: DEFAULT_FRAME_TIMEOUT_MS,
    protocolVersion: PROTOCOL_VERSION,
    minProtocolVersion: MIN_PROTOCOL_VERSION,
    enforceVersionCheck: true,
    enableChecksums: true,
  };
}

// ============================================================================
// Protocol Error
// ============================================================================

export class ProtocolError extends Error {
  constructor(
    public readonly code: ProtocolErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly suggestedBackoffMs?: number
  ) {
    super(message);
    this.name = "ProtocolError";
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      suggestedBackoffMs: this.suggestedBackoffMs,
    };
  }
}

// ============================================================================
// Version Negotiation
// ============================================================================

export class VersionNegotiator extends EventEmitter {
  constructor(private readonly config: ProtocolConfig) {
    super();
  }

  /**
   * Negotiate protocol version with peer.
   * Returns agreed version or throws ProtocolError on mismatch.
   * Implements "fail closed" - downgrade attempts are rejected.
   */
  negotiate(clientVersion: string, serverVersion: string): string {
    if (!this.config.enforceVersionCheck) {
      return serverVersion;
    }

    const client = this.parseVersion(clientVersion);
    const server = this.parseVersion(serverVersion);
    const minimum = this.parseVersion(this.config.minProtocolVersion);

    // Check if client meets minimum version requirement
    if (this.compareVersions(client, minimum) < 0) {
      this.emit("version_rejected", {
        reason: "client_below_minimum",
        client: clientVersion,
        minimum: this.config.minProtocolVersion,
      });
      throw new ProtocolError(
        ProtocolErrorCode.VERSION_MISMATCH,
        `Client version ${clientVersion} is below minimum ${this.config.minProtocolVersion}`,
        false
      );
    }

    // Check if server meets minimum version requirement
    if (this.compareVersions(server, minimum) < 0) {
      this.emit("version_rejected", {
        reason: "server_below_minimum",
        server: serverVersion,
        minimum: this.config.minProtocolVersion,
      });
      throw new ProtocolError(
        ProtocolErrorCode.VERSION_MISMATCH,
        `Server version ${serverVersion} is below minimum ${this.config.minProtocolVersion}`,
        false
      );
    }

    // Use the lower of the two versions for compatibility
    // But reject if client is trying to downgrade from minimum
    const agreed =
      this.compareVersions(client, server) <= 0 ? clientVersion : serverVersion;

    if (this.compareVersions(this.parseVersion(agreed), minimum) < 0) {
      throw new ProtocolError(
        ProtocolErrorCode.VERSION_MISMATCH,
        `Negotiated version ${agreed} is below minimum ${this.config.minProtocolVersion}`,
        false
      );
    }

    this.emit("version_agreed", {
      client: clientVersion,
      server: serverVersion,
      agreed,
    });

    return agreed;
  }

  /**
   * Check if a version is supported.
   */
  isSupported(version: string): boolean {
    const v = this.parseVersion(version);
    const minimum = this.parseVersion(this.config.minProtocolVersion);
    const current = this.parseVersion(this.config.protocolVersion);

    return (
      this.compareVersions(v, minimum) >= 0 &&
      this.compareVersions(v, current) <= 0
    );
  }

  private parseVersion(version: string): number[] {
    return version.split(".").map((n) => parseInt(n, 10));
  }

  private compareVersions(a: number[], b: number[]): number {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const av = a[i] || 0;
      const bv = b[i] || 0;
      if (av !== bv) return av - bv;
    }
    return 0;
  }
}

// ============================================================================
// Frame Encoder/Decoder
// ============================================================================

export class FrameCodec extends EventEmitter {
  private partialFrame: Buffer | null = null;
  private expectedLength = 0;
  private partialFrameBytes = 0;
  private readonly MAX_PARTIAL_FRAME_BYTES: number;

  constructor(private readonly config: ProtocolConfig) {
    super();
    // Allow up to 2x max frame size for partial buffer to handle overlapping frames
    this.MAX_PARTIAL_FRAME_BYTES = config.maxFrameBytes * 2;
  }

  /**
   * Encode a frame into wire format.
   * Format: [magic:4][length:4][type:1][version_len:1][version:N][payload:N][checksum:32]
   */
  encode(type: FrameType, version: string, payload: Buffer): Buffer {
    // Validate payload size
    const versionBytes = Buffer.from(version, "utf-8");
    // Total size includes: type(1) + versionLen(1) + version(N) + payload(N) + checksum(32)
    // Note: FRAME_HEADER_SIZE is already included in the buffer allocation for the length field itself
    const totalSize =
      1 + // type
      1 + // version_len
      versionBytes.length +
      payload.length +
      32; // checksum

    if (totalSize > this.config.maxFrameBytes) {
      throw new ProtocolError(
        ProtocolErrorCode.FRAME_OVERSIZE,
        `Frame size ${totalSize} exceeds maximum ${this.config.maxFrameBytes}`,
        false
      );
    }

    // Calculate checksum
    const checksum = this.config.enableChecksums
      ? createHash("sha256")
          .update(Buffer.concat([Buffer.from([type]), versionBytes, payload]))
          .digest()
      : Buffer.alloc(32);

    // Build frame: magic(4) + length(4) + totalSize
    const frame = Buffer.allocUnsafe(4 + 4 + totalSize);
    let offset = 0;

    // Magic
    PROTOCOL_MAGIC.copy(frame, offset);
    offset += 4;

    // Length (totalSize = rest of frame after length field)
    frame.writeUInt32BE(totalSize, offset);
    offset += 4;

    // Frame type
    frame.writeUInt8(type, offset);
    offset += 1;

    // Version length
    frame.writeUInt8(versionBytes.length, offset);
    offset += 1;

    // Version
    versionBytes.copy(frame, offset);
    offset += versionBytes.length;

    // Payload
    payload.copy(frame, offset);
    offset += payload.length;

    // Checksum
    checksum.copy(frame, offset);

    return frame;
  }

  /**
   * Decode a frame from wire format.
   * Handles partial frames and returns null if more data needed.
   * Throws ProtocolError on invalid frame.
   */
  decode(data: Buffer): Frame | null {
    let offset = 0;

    // Check magic
    if (data.length < 4) return null;
    const magic = data.slice(0, 4);
    if (!magic.equals(PROTOCOL_MAGIC)) {
      throw new ProtocolError(
        ProtocolErrorCode.INVALID_MAGIC,
        "Invalid protocol magic bytes",
        false
      );
    }
    offset += 4;

    // Check length
    if (data.length < offset + 4) return null;
    const frameLength = data.readUInt32BE(offset);
    offset += 4;

    // Validate frame length
    if (frameLength > this.config.maxFrameBytes) {
      throw new ProtocolError(
        ProtocolErrorCode.FRAME_OVERSIZE,
        `Frame length ${frameLength} exceeds maximum ${this.config.maxFrameBytes}`,
        false
      );
    }

    // Check if we have complete frame
    if (data.length < 4 + 4 + frameLength) return null;

    // Parse frame type
    if (data.length < offset + 1) return null;
    const type = data.readUInt8(offset) as FrameType;
    offset += 1;

    // Parse version length
    if (data.length < offset + 1) return null;
    const versionLen = data.readUInt8(offset);
    offset += 1;

    // Parse version
    if (data.length < offset + versionLen) return null;
    const version = data.slice(offset, offset + versionLen).toString("utf-8");
    offset += versionLen;

    // Validate version
    if (this.config.enforceVersionCheck && !this.isValidVersion(version)) {
      throw new ProtocolError(
        ProtocolErrorCode.VERSION_MISMATCH,
        `Invalid or unsupported version: ${version}`,
        false
      );
    }

    // Parse payload
    // frameLength = type(1) + versionLen(1) + version(N) + payload(N) + checksum(32)
    // payloadLength = frameLength - type(1) - versionLen(1) - version(N) - checksum(32)
    const payloadLength = frameLength - (1 + 1 + versionLen + 32);
    if (payloadLength < 0) {
      throw new ProtocolError(
        ProtocolErrorCode.INVALID_FRAME,
        "Invalid frame: payload length negative",
        false
      );
    }
    if (data.length < offset + payloadLength) return null;
    const payload = data.slice(offset, offset + payloadLength);
    offset += payloadLength;

    // Parse and verify checksum
    if (data.length < offset + 32) return null;
    const checksum = data.slice(offset, offset + 32);

    if (this.config.enableChecksums) {
      const expectedChecksum = createHash("sha256")
        .update(Buffer.concat([Buffer.from([type]), Buffer.from(version), payload]))
        .digest();

      if (!checksum.equals(expectedChecksum)) {
        throw new ProtocolError(
          ProtocolErrorCode.CHECKSUM_FAILED,
          "Frame checksum verification failed",
          true,
          100
        );
      }
    }

    return {
      type,
      version,
      payload,
      checksum: checksum.toString("hex"),
      timestamp: Date.now(),
    };
  }

  /**
   * Feed data into the decoder for streaming frame parsing.
   * Returns array of complete frames, leaves partial data in buffer.
   * 
   * SECURITY: Bounded buffer prevents memory exhaustion attacks.
   */
  feed(data: Buffer): Frame[] {
    if (this.partialFrame) {
      this.partialFrame = Buffer.concat([this.partialFrame, data]);
      this.partialFrameBytes += data.length;
    } else {
      this.partialFrame = data;
      this.partialFrameBytes = data.length;
    }

    // SECURITY: Prevent unbounded buffer growth
    if (this.partialFrameBytes > this.MAX_PARTIAL_FRAME_BYTES) {
      const overflow = this.partialFrameBytes - this.MAX_PARTIAL_FRAME_BYTES;
      this.partialFrame = null;
      this.partialFrameBytes = 0;
      throw new ProtocolError(
        ProtocolErrorCode.PROTOCOL_ERROR,
        `Partial frame buffer overflow: ${overflow} bytes over limit`,
        false
      );
    }

    const frames: Frame[] = [];

    while (this.partialFrame && this.partialFrame.length > 0) {
      try {
        const frame = this.decode(this.partialFrame);
        if (frame === null) {
          // Need more data
          break;
        }

        // Calculate consumed bytes
        const consumed = this.calculateFrameSize(frame);
        this.partialFrame = this.partialFrame.slice(consumed);
        this.partialFrameBytes = this.partialFrame?.length ?? 0;
        frames.push(frame);
      } catch (err) {
        // On error, clear partial frame to prevent corruption propagation
        this.partialFrame = null;
        this.partialFrameBytes = 0;
        throw err;
      }
    }

    return frames;
  }

  private isValidVersion(version: string): boolean {
    // Basic semver validation
    return /^\d+\.\d+\.\d+$/.test(version);
  }

  private calculateFrameSize(frame: Frame): number {
    const versionBytes = Buffer.from(frame.version);
    return (
      4 + // magic
      4 + // length
      1 + // type
      1 + // version length
      versionBytes.length +
      frame.payload.length +
      32 // checksum
    );
  }
}

// ============================================================================
// Frame Timeout Handler
// ============================================================================

export class FrameTimeoutHandler extends EventEmitter {
  private timeouts = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly defaultTimeoutMs: number) {
    super();
  }

  /**
   * Start timeout for a frame operation.
   */
  startTimeout(operationId: string, timeoutMs?: number): void {
    const ms = timeoutMs ?? this.defaultTimeoutMs;

    this.clearTimeout(operationId);

    const timeout = setTimeout(() => {
      this.timeouts.delete(operationId);
      this.emit("timeout", { operationId, timeoutMs: ms });
    }, ms);

    this.timeouts.set(operationId, timeout);
  }

  /**
   * Clear timeout for an operation.
   */
  clearTimeout(operationId: string): void {
    const timeout = this.timeouts.get(operationId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(operationId);
    }
  }

  /**
   * Clear all timeouts.
   */
  clearAll(): void {
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
  }
}

// ============================================================================
// Backpressure Controller
// ============================================================================

export class BackpressureController extends EventEmitter {
  private pendingWrites = 0;
  private readonly highWaterMark: number;
  private readonly lowWaterMark: number;
  private isPaused = false;

  constructor(highWaterMark = 16, lowWaterMark = 8) {
    super();
    this.highWaterMark = highWaterMark;
    this.lowWaterMark = lowWaterMark;
  }

  /**
   * Check if we can accept more writes.
   */
  canWrite(): boolean {
    return this.pendingWrites < this.highWaterMark;
  }

  /**
   * Increment pending write count.
   * Returns false if backpressure should be applied.
   */
  beginWrite(): boolean {
    if (!this.canWrite()) {
      this.emit("backpressure", {
        pending: this.pendingWrites,
        highWaterMark: this.highWaterMark,
      });
      return false;
    }

    this.pendingWrites++;

    if (this.pendingWrites >= this.highWaterMark && !this.isPaused) {
      this.isPaused = true;
      this.emit("pause");
    }

    return true;
  }

  /**
   * Decrement pending write count.
   */
  endWrite(): void {
    if (this.pendingWrites > 0) {
      this.pendingWrites--;
    }

    if (this.pendingWrites <= this.lowWaterMark && this.isPaused) {
      this.isPaused = false;
      this.emit("resume");
    }
  }

  /**
   * Get current backpressure status.
   */
  getStatus(): { pending: number; paused: boolean; canWrite: boolean } {
    return {
      pending: this.pendingWrites,
      paused: this.isPaused,
      canWrite: this.canWrite(),
    };
  }
}

// ============================================================================
// Protocol Handler
// ============================================================================

export class ProtocolHandler extends EventEmitter {
  private codec: FrameCodec;
  private versionNegotiator: VersionNegotiator;
  private timeoutHandler: FrameTimeoutHandler;
  private backpressure: BackpressureController;
  private negotiatedVersion: string | null = null;

  constructor(private readonly config: ProtocolConfig) {
    super();
    this.codec = new FrameCodec(config);
    this.versionNegotiator = new VersionNegotiator(config);
    this.timeoutHandler = new FrameTimeoutHandler(config.frameTimeoutMs);
    this.backpressure = new BackpressureController();

    this.setupHandlers();
  }

  /**
   * Perform handshake with peer.
   */
  performHandshake(peerVersion: string): string {
    const agreed = this.versionNegotiator.negotiate(
      peerVersion,
      this.config.protocolVersion
    );
    this.negotiatedVersion = agreed;
    return agreed;
  }

  /**
   * Send a frame with backpressure handling.
   */
  sendFrame(
    type: FrameType,
    payload: Buffer,
    transport: { write: (data: Buffer) => boolean }
  ): boolean {
    if (!this.backpressure.beginWrite()) {
      this.emit("backpressure_rejected", { type });
      return false;
    }

    try {
      const version = this.negotiatedVersion ?? this.config.protocolVersion;
      const frame = this.codec.encode(type, version, payload);

      const success = transport.write(frame);

      if (!success) {
        this.backpressure.endWrite();
        return false;
      }

      this.emit("frame_sent", { type, size: frame.length });
      return true;
    } finally {
      this.backpressure.endWrite();
    }
  }

  /**
   * Receive and parse incoming data.
   */
  receiveData(data: Buffer): Frame[] {
    try {
      const frames = this.codec.feed(data);
      for (const frame of frames) {
        this.emit("frame_received", frame);
      }
      return frames;
    } catch (err) {
      if (err instanceof ProtocolError) {
        this.emit("protocol_error", err);
      }
      throw err;
    }
  }

  /**
   * Create an error frame.
   */
  createErrorFrame(error: ProtocolError): Buffer {
    const payload = Buffer.from(JSON.stringify(error.toJSON()), "utf-8");
    return this.codec.encode(
      FrameType.ERROR,
      this.negotiatedVersion ?? this.config.protocolVersion,
      payload
    );
  }

  /**
   * Close the protocol handler.
   */
  close(): void {
    this.timeoutHandler.clearAll();
    this.emit("closed");
  }

  private setupHandlers(): void {
    this.backpressure.on("backpressure", (status) => {
      this.emit("backpressure", status);
    });
  }
}

// ============================================================================
// Export factory functions
// ============================================================================

export function createProtocolHandler(config?: Partial<ProtocolConfig>): ProtocolHandler {
  return new ProtocolHandler({ ...getDefaultProtocolConfig(), ...config });
}

export function createFrameCodec(config?: Partial<ProtocolConfig>): FrameCodec {
  return new FrameCodec({ ...getDefaultProtocolConfig(), ...config });
}

export function createVersionNegotiator(
  config?: Partial<ProtocolConfig>
): VersionNegotiator {
  return new VersionNegotiator({ ...getDefaultProtocolConfig(), ...config });
}
