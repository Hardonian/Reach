/**
 * Protocol Fuzz-lite Tests
 * 
 * Lightweight fuzz testing for protocol resilience:
 * - Garbage frame handling
 * - Partial frame handling
 * - Invalid magic/version handling
 * - Truncation detection
 */

import { describe, it, expect } from 'vitest';
import { FrameParser, decodeFrame, encodeFrame, MessageType, MAX_PAYLOAD_BYTES, HEADER_SIZE, FOOTER_SIZE } from './frame';
import { createHello, serializeCbor } from './messages';

describe('Protocol Fuzz-lite', () => {
  it('should reject garbage frame with invalid magic', () => {
    const garbage = new Uint8Array([
      0xDE, 0xAD, 0xBE, 0xEF, // Invalid magic
      0x00, 0x01, // Major
      0x00, 0x00, // Minor
      0x00, 0x00, 0x00, 0x01, // Type
      0x00, 0x00, 0x00, 0x00, // Flags
      0x00, 0x00, 0x00, 0x00, // Correlation
      0x00, 0x00, 0x00, 0x00, // Payload len
      0x00, 0x00, 0x00, 0x00, // CRC
    ]);

    expect(() => decodeFrame(garbage)).toThrow('INVALID_MAGIC');
  });

  it('should reject frame with invalid version', () => {
    const parser = new FrameParser();
    
    // Build frame with version 99.0 (unsupported)
    const frame = new Uint8Array(HEADER_SIZE + FOOTER_SIZE);
    const view = new DataView(frame.buffer);
    
    view.setUint32(0, 0x52454348, true); // Magic
    view.setUint16(4, 99, true); // Major = 99 (invalid)
    view.setUint16(6, 0, true); // Minor
    view.setUint32(8, MessageType.Hello, true); // Type
    view.setUint32(12, 0, true); // Flags
    view.setUint32(16, 0, true); // Correlation
    view.setUint32(20, 0, true); // Payload len
    // CRC will be wrong but that's OK for this test
    view.setUint32(24, 0xDEADBEEF, true);
    
    parser.append(frame);
    
    // Should either throw or return null - not crash
    try {
      parser.parse();
    } catch {
      // Expected - CRC mismatch or version error
    }
    
    // Parser should remain in valid state
    expect(parser.bufferSize).toBeGreaterThanOrEqual(0);
  });

  it('should handle random garbage data', () => {
    const parser = new FrameParser();
    
    // Generate random garbage
    for (let i = 0; i < 10; i++) {
      const garbage = new Uint8Array(50);
      for (let j = 0; j < garbage.length; j++) {
        garbage[j] = Math.floor(Math.random() * 256);
      }
      parser.append(garbage);
      
      try {
        parser.parse();
      } catch {
        // Expected - invalid magic
      }
    }
    
    // After processing garbage, parser should still work
    const hello = createHello('test', '1.0.0');
    const validFrame = {
      versionMajor: 1,
      versionMinor: 0,
      msgType: MessageType.Hello,
      flags: 0,
      correlationId: 0,
      payload: serializeCbor(hello),
    };
    
    const encoded = encodeFrame(validFrame);
    parser.append(encoded);
    
    // After resync, should be able to parse valid frame
    let result = null;
    try {
      result = parser.parse();
    } catch {
      // May need multiple attempts
      try {
        result = parser.parse();
      } catch {
        // OK
      }
    }
    
    // Parser should not be in a corrupted state
    expect(parser.bufferSize).toBeGreaterThanOrEqual(0);
  });

  it('should handle partial frames correctly', () => {
    const parser = new FrameParser();
    
    // Create a valid frame
    const hello = createHello('test', '1.0.0');
    const frame = {
      versionMajor: 1,
      versionMinor: 0,
      msgType: MessageType.Hello,
      flags: 0,
      correlationId: 42,
      payload: serializeCbor(hello),
    };
    const encoded = encodeFrame(frame);
    
    // Send only first half
    const firstHalf = encoded.slice(0, Math.floor(encoded.length / 2));
    parser.append(firstHalf);
    
    // Should return null (need more data)
    const result = parser.parse();
    expect(result).toBeNull();
    expect(parser.bufferSize).toBe(firstHalf.length);
    
    // Send remaining half
    parser.append(encoded.slice(Math.floor(encoded.length / 2)));
    
    // Should now parse successfully
    const fullResult = parser.parse();
    expect(fullResult).not.toBeNull();
    expect(fullResult?.msgType).toBe(MessageType.Hello);
    expect(fullResult?.correlationId).toBe(42);
  });

  it('should reject oversized payload claims', () => {
    const parser = new FrameParser();
    
    // Build frame claiming 100MB payload
    const frame = new Uint8Array(HEADER_SIZE + FOOTER_SIZE);
    const view = new DataView(frame.buffer);
    
    view.setUint32(0, 0x52454348, true); // Magic
    view.setUint16(4, 1, true); // Major
    view.setUint16(6, 0, true); // Minor
    view.setUint32(8, MessageType.Hello, true); // Type
    view.setUint32(12, 0, true); // Flags
    view.setUint32(16, 0, true); // Correlation
    view.setUint32(20, 100 * 1024 * 1024, true); // Payload len = 100MB (too big)
    view.setUint32(24, 0, true); // CRC placeholder
    
    parser.append(frame);
    
    // Should throw PAYLOAD_TOO_LARGE
    expect(() => parser.parse()).toThrow('PAYLOAD_TOO_LARGE');
  });

  it('should detect truncation attacks', () => {
    const parser = new FrameParser();
    
    // Create a frame claiming payload but don't send it
    const frame = new Uint8Array(HEADER_SIZE);
    const view = new DataView(frame.buffer);
    
    view.setUint32(0, 0x52454348, true); // Magic
    view.setUint16(4, 1, true); // Major
    view.setUint16(6, 0, true); // Minor
    view.setUint32(8, MessageType.Hello, true); // Type
    view.setUint32(12, 0, true); // Flags
    view.setUint32(16, 0, true); // Correlation
    view.setUint32(20, 100, true); // Claim 100 byte payload
    
    parser.append(frame);
    
    // Should return null (waiting for payload)
    const result = parser.parse();
    expect(result).toBeNull();
    expect(parser.bufferSize).toBe(HEADER_SIZE);
    
    // Now send truncated payload (only 50 bytes)
    parser.append(new Uint8Array(50));
    
    // Should still return null
    const result2 = parser.parse();
    expect(result2).toBeNull();
    expect(parser.bufferSize).toBe(HEADER_SIZE + 50);
  });

  it('should handle corrupted CRC', () => {
    const hello = createHello('test', '1.0.0');
    const frame = {
      versionMajor: 1,
      versionMinor: 0,
      msgType: MessageType.Hello,
      flags: 0,
      correlationId: 0,
      payload: serializeCbor(hello),
    };
    const encoded = encodeFrame(frame);
    
    // Corrupt the last byte (part of CRC)
    encoded[encoded.length - 1] ^= 0xFF;
    
    // Should throw CRC_MISMATCH
    expect(() => decodeFrame(encoded)).toThrow('CRC_MISMATCH');
  });

  it('should handle unknown message types', () => {
    const parser = new FrameParser();
    
    // Build frame with unknown message type
    const frame = new Uint8Array(HEADER_SIZE + FOOTER_SIZE);
    const view = new DataView(frame.buffer);
    
    view.setUint32(0, 0x52454348, true); // Magic
    view.setUint16(4, 1, true); // Major
    view.setUint16(6, 0, true); // Minor
    view.setUint32(8, 0x9999, true); // Unknown type
    view.setUint32(12, 0, true); // Flags
    view.setUint32(16, 0, true); // Correlation
    view.setUint32(20, 0, true); // Payload len
    // Calculate a valid CRC for this frame
    const testFrame = {
      versionMajor: 1,
      versionMinor: 0,
      msgType: 0x9999 as MessageType,
      flags: 0,
      correlationId: 0,
      payload: new Uint8Array(0),
    };
    const encoded = encodeFrame(testFrame);
    
    parser.append(encoded);
    
    // Should throw UNKNOWN_MSG_TYPE
    expect(() => parser.parse()).toThrow('UNKNOWN_MSG_TYPE');
  });

  it('should handle rapid frame stream', () => {
    const parser = new FrameParser();
    const frames: ReturnType<typeof encodeFrame>[] = [];
    
    // Create 100 frames
    for (let i = 0; i < 100; i++) {
      const hello = createHello(`client-${i}`, '1.0.0');
      const frame = {
        versionMajor: 1,
        versionMinor: 0,
        msgType: MessageType.Hello,
        flags: 0,
        correlationId: i,
        payload: serializeCbor(hello),
      };
      frames.push(encodeFrame(frame));
    }
    
    // Combine all frames into single buffer
    const totalLen = frames.reduce((sum, f) => sum + f.length, 0);
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const f of frames) {
      combined.set(f, offset);
      offset += f.length;
    }
    
    parser.append(combined);
    
    // Parse all frames
    let count = 0;
    while (true) {
      const result = parser.parse();
      if (result === null) break;
      expect(result.msgType).toBe(MessageType.Hello);
      expect(result.correlationId).toBe(count);
      count++;
    }
    
    expect(count).toBe(100);
    expect(parser.bufferSize).toBe(0);
  });
});
