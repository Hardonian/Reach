declare module 'blake3' {
  export interface Hasher {
    update(data: string | Buffer | Uint8Array, encoding?: string): this;
    digest(encoding?: string): Buffer | string;
  }

  export function createHasher(): Hasher;
  export function hash(data: string | Buffer | Uint8Array): Buffer;
}
