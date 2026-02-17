import { describe, expect, it, vi } from 'vitest';
import { BridgeClient, WebSocketLike } from '../bridgeClient';

type SocketHandler = (() => void) | ((data: string | Buffer | ArrayBuffer | Buffer[]) => void) | ((error: Error) => void);

class FakeSocket implements WebSocketLike {
  private handlers: Record<string, SocketHandler[]> = {};

  on(event: 'open', listener: () => void): void;
  on(event: 'message', listener: (data: string | Buffer | ArrayBuffer | Buffer[]) => void): void;
  on(event: 'close', listener: () => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  on(event: 'open' | 'message' | 'close' | 'error', listener: SocketHandler): void {
    this.handlers[event] = this.handlers[event] ?? [];
    this.handlers[event].push(listener);
  }

  send(): void {
    // no-op for reconnect test
  }

  close(): void {
    this.emit('close');
  }

  emit(event: string, ...args: unknown[]): void {
    for (const listener of this.handlers[event] ?? []) {
      if (event === 'message') {
        (listener as (data: string | Buffer | ArrayBuffer | Buffer[]) => void)(args[0] as string | Buffer | ArrayBuffer | Buffer[]);
      } else if (event === 'error') {
        (listener as (error: Error) => void)(args[0] as Error);
      } else {
        (listener as () => void)();
      }
    }
  }
}

describe('BridgeClient reconnect', () => {
  it('reconnects after socket close', async () => {
    vi.useFakeTimers();
    const sockets: FakeSocket[] = [];

    const client = new BridgeClient({
      getUrl: () => 'ws://localhost:8787',
      reconnectDelayMs: 50,
      webSocketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      }
    });

    client.connect();
    expect(sockets.length).toBe(1);

    sockets[0].emit('close');
    await vi.advanceTimersByTimeAsync(60);

    expect(sockets.length).toBe(2);

    client.dispose();
    vi.useRealTimers();
  });
});
