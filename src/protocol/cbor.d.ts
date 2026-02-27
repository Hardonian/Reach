/**
 * Type declarations for cbor package
 */

declare module 'cbor' {
  export function encode(data: unknown): Buffer;
  export function decode(data: Buffer | Uint8Array): unknown;
  export function encodeCanonical(data: unknown): Buffer;
  
  export class Encoder {
    static encodeCanonical(data: unknown): Buffer;
  }
}
