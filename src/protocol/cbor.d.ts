/**
 * Type declarations for cbor package
 */

declare module 'cbor' {
  export function encode(data: unknown): Buffer;
  export function decode(data: Buffer | Uint8Array): unknown;
}
