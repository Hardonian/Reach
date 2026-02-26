/**
 * Binary Protocol Frame Codec (TypeScript)
 * 
 * Implements the streaming, length-prefixed frame format
 * for communication with the Requiem engine.
 */

export const MAGIC = 0x52454348; // "RECH"
export const MAX_PAYLOAD_BYTES = 64 * 1024 * 1024; // 64 MiB
export const HEADER_SIZE = 22;
export const FOOTER_SIZE = 4;
export const FRAME_OVERHEAD = HEADER_SIZE + FOOTER_SIZE;

export const PROTOCOL_VERSION_MAJOR = 1;
export const PROTOCOL_VERSION_MINOR = 0;

/** Frame flags */
export enum FrameFlags {
  NONE = 0,
  COMPRESSED = 1 << 0,
  EOS = 1 << 1,
  CORRELATION = 1 << 2,
}

/** Message types */
export enum MessageType {
  Hello = 0x01,
  HelloAck = 0x02,
  ExecRequest = 0x10,
  ExecResult = 0x11,
  HealthRequest = 0x20,
  HealthResult = 0x21,
  Error = 0xFF,
}

/** Protocol frame structure */
export interface Frame {
  versionMajor: number;
  versionMinor: number;
  msgType: MessageType;
  flags: FrameFlags;
  payload: Uint8Array;
}

/** Frame parsing errors */
export class FrameError extends Error {
  constructor(
    message: string,
    public readonly code: 'INVALID_MAGIC' | 'UNSUPPORTED_VERSION' | 'UNKNOWN_MSG_TYPE' | 
                          'PAYLOAD_TOO_LARGE' | 'CRC_MISMATCH' | 'INCOMPLETE' | 'IO_ERROR',
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'FrameError';
  }
}

/** CRC32C implementation */
function crc32c(data: Uint8Array): number {
  // CRC32C polynomial: 0x1EDC6F41
  const CRC32C_TABLE = new Uint32Array(256);
  const POLYNOMIAL = 0x82F63B78; // Reversed polynomial
  
  // Initialize table (only once would be better, but for simplicity...)
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? (crc >>> 1) ^ POLYNOMIAL : crc >>> 1;
    }
    CRC32C_TABLE[i] = crc >>> 0;
  }
  
  let crc = 0xFFFFFFFF;
  for (const byte of data) {
    crc = (crc >>> 8) ^ CRC32C_TABLE[(crc ^ byte) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** Write little-endian uint32 to buffer */
function writeUInt32LE(buffer: Uint8Array, offset: number, value: number): void {
  buffer[offset] = value & 0xFF;
  buffer[offset + 1] = (value >>> 8) & 0xFF;
  buffer[offset + 2] = (value >>> 16) & 0xFF;
  buffer[offset + 3] = (value >>> 24) & 0xFF;
}

/** Write little-endian uint16 to buffer */
function writeUInt16LE(buffer: Uint8Array, offset: number, value: number): void {
  buffer[offset] = value & 0xFF;
  buffer[offset + 1] = (value >>> 8) & 0xFF;
}

/** Read little-endian uint32 from buffer */
function readUInt32LE(buffer: Uint8Array, offset: number): number {
  return (buffer[offset] | 
          (buffer[offset + 1] << 8) | 
          (buffer[offset + 2] << 16) | 
          (buffer[offset + 3] << 24)) >>> 0;
}

/** Read little-endian uint16 from buffer */
function readUInt16LE(buffer: Uint8Array, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8);
}

/** Calculate CRC32C for a frame */
function calculateFrameCRC(frame: Frame): number {
  const header = new Uint8Array(HEADER_SIZE);
  writeUInt32LE(header, 0, MAGIC);
  writeUInt16LE(header, 4, frame.versionMajor);
  writeUInt16LE(header, 6, frame.versionMinor);
  writeUInt32LE(header, 8, frame.msgType);
  writeUInt32LE(header, 12, frame.flags);
  writeUInt32LE(header, 16, frame.payload.length);
  
  // Calculate CRC over header (excluding CRC field) + payload
  const crcData = new Uint8Array(HEADER_SIZE + frame.payload.length);
  crcData.set(header);
  crcData.set(frame.payload, HEADER_SIZE);
  
  return crc32c(crcData);
}

/** Encode a frame to bytes */
export function encodeFrame(frame: Frame): Uint8Array {
  const payloadLen = frame.payload.length;
  const totalLen = FRAME_OVERHEAD + payloadLen;
  const buffer = new Uint8Array(totalLen);
  
  // Write header
  writeUInt32LE(buffer, 0, MAGIC);
  writeUInt16LE(buffer, 4, frame.versionMajor);
  writeUInt16LE(buffer, 6, frame.versionMinor);
  writeUInt32LE(buffer, 8, frame.msgType);
  writeUInt32LE(buffer, 12, frame.flags);
  writeUInt32LE(buffer, 16, payloadLen);
  
  // Write payload
  buffer.set(frame.payload, HEADER_SIZE);
  
  // Calculate and write CRC
  const crc = calculateFrameCRC(frame);
  writeUInt32LE(buffer, HEADER_SIZE + payloadLen, crc);
  
  return buffer;
}

/** Try to decode a frame from buffer */
export function decodeFrame(buffer: Uint8Array): { frame: Frame; remaining: Uint8Array } | null {
  // Need at least header
  if (buffer.length < HEADER_SIZE) {
    return null;
  }
  
  // Check magic
  const magic = readUInt32LE(buffer, 0);
  if (magic !== MAGIC) {
    throw new FrameError(
      `Invalid magic: expected 0x${MAGIC.toString(16).toUpperCase()}, got 0x${magic.toString(16).toUpperCase()}`,
      'INVALID_MAGIC',
      { expected: MAGIC, got: magic }
    );
  }
  
  // Parse header
  const versionMajor = readUInt16LE(buffer, 4);
  const versionMinor = readUInt16LE(buffer, 6);
  const msgTypeRaw = readUInt32LE(buffer, 8);
  const flags = readUInt32LE(buffer, 12);
  const payloadLen = readUInt32LE(buffer, 16);
  
  // Validate message type
  if (!Object.values(MessageType).includes(msgTypeRaw)) {
    throw new FrameError(
      `Unknown message type: 0x${msgTypeRaw.toString(16).toUpperCase()}`,
      'UNKNOWN_MSG_TYPE',
      { msgType: msgTypeRaw }
    );
  }
  
  // Validate payload size
  if (payloadLen > MAX_PAYLOAD_BYTES) {
    throw new FrameError(
      `Payload too large: ${payloadLen} bytes (max ${MAX_PAYLOAD_BYTES})`,
      'PAYLOAD_TOO_LARGE',
      { size: payloadLen, max: MAX_PAYLOAD_BYTES }
    );
  }
  
  // Check if we have complete frame
  const totalFrameLen = FRAME_OVERHEAD + payloadLen;
  if (buffer.length < totalFrameLen) {
    return null; // Need more data
  }
  
  // Extract payload
  const payload = buffer.slice(HEADER_SIZE, HEADER_SIZE + payloadLen);
  
  // Verify CRC
  const expectedCRC = readUInt32LE(buffer, HEADER_SIZE + payloadLen);
  const frame: Frame = {
    versionMajor,
    versionMinor,
    msgType: msgTypeRaw as MessageType,
    flags,
    payload,
  };
  const calculatedCRC = calculateFrameCRC(frame);
  
  if (expectedCRC !== calculatedCRC) {
    throw new FrameError(
      `CRC mismatch: expected 0x${expectedCRC.toString(16).toUpperCase()}, calculated 0x${calculatedCRC.toString(16).toUpperCase()}`,
      'CRC_MISMATCH',
      { expected: expectedCRC, calculated: calculatedCRC }
    );
  }
  
  return {
    frame,
    remaining: buffer.slice(totalFrameLen),
  };
}

/** Streaming frame parser with buffering */
export class FrameParser {
  private buffer: Uint8Array = new Uint8Array(0);
  private maxBufferSize: number;
  
  constructor(options: { maxBufferSize?: number } = {}) {
    this.maxBufferSize = options.maxBufferSize ?? 64 * 1024 * 1024;
  }
  
  /** Add data to buffer */
  append(data: Uint8Array): void {
    const newBuffer = new Uint8Array(this.buffer.length + data.length);
    newBuffer.set(this.buffer);
    newBuffer.set(data, this.buffer.length);
    this.buffer = newBuffer;
    
    // Prevent unbounded growth
    if (this.buffer.length > this.maxBufferSize) {
      throw new FrameError(
        `Buffer overflow: ${this.buffer.length} bytes exceeds ${this.maxBufferSize}`,
        'IO_ERROR'
      );
    }
  }
  
  /** Try to parse a frame from buffer */
  parse(): Frame | null {
    if (this.buffer.length === 0) {
      return null;
    }
    
    try {
      const result = decodeFrame(this.buffer);
      if (result) {
        this.buffer = result.remaining;
        return result.frame;
      }
      return null;
    } catch (error) {
      if (error instanceof FrameError && error.code === 'INVALID_MAGIC') {
        // Try to resync by finding next magic
        this.resync();
        return null;
      }
      throw error;
    }
  }
  
  /** Find and skip to next valid magic bytes */
  private resync(): void {
    const magicBytes = new Uint8Array([
      MAGIC & 0xFF,
      (MAGIC >>> 8) & 0xFF,
      (MAGIC >>> 16) & 0xFF,
      (MAGIC >>> 24) & 0xFF,
    ]);
    
    for (let i = 1; i <= this.buffer.length - 4; i++) {
      if (this.buffer[i] === magicBytes[0] &&
          this.buffer[i + 1] === magicBytes[1] &&
          this.buffer[i + 2] === magicBytes[2] &&
          this.buffer[i + 3] === magicBytes[3]) {
        this.buffer = this.buffer.slice(i);
        return;
      }
    }
    
    // No magic found, keep last 3 bytes (might be partial magic)
    this.buffer = this.buffer.slice(-3);
  }
  
  /** Clear buffer */
  clear(): void {
    this.buffer = new Uint8Array(0);
  }
  
  /** Get current buffer size */
  get bufferSize(): number {
    return this.buffer.length;
  }
}
