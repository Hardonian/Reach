import { FrameParser, decodeFrame, MAX_PAYLOAD_BYTES } from './src/protocol/frame';

const testParser = new FrameParser();
const payloadLen = 65 * 1024 * 1024; // 65 MiB
const lenBytes = new Uint8Array(4);
const view = new DataView(lenBytes.buffer);
view.setUint32(0, payloadLen, true);

// Fixed: Complete 22-byte header
const header = new Uint8Array([
  0x52, 0x45, 0x43, 0x48, // Magic (4 bytes)
  0x00, 0x01, // Major version (2 bytes)
  0x00, 0x00, // Minor version (2 bytes)
  0x00, 0x00, 0x00, 0x01, // Type (4 bytes)
  0x00, 0x00, 0x00, 0x00, // Flags (4 bytes)
  lenBytes[0], lenBytes[1], lenBytes[2], lenBytes[3], // Payload length (4 bytes) = 22 total
]);

console.log('Header length:', header.length);
console.log('Expected HEADER_SIZE:', 22);

testParser.append(header);
console.log('Buffer size:', testParser.bufferSize);
console.log('MAX_PAYLOAD_BYTES:', MAX_PAYLOAD_BYTES);
console.log('Payload length in header:', payloadLen);

try {
  const result = testParser.parse();
  console.log('Parse result:', result);
} catch (e: any) {
  console.log('Caught error:', e.message);
  console.log('Error code:', e.code);
}
