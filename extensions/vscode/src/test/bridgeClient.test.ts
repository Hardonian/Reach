import { describe, expect, it, vi } from 'vitest';
import { BridgeClient, WebSocketLike } from '../bridgeClient';

class FakeSocket implements WebSocketLike {
  private handlers: Record<string, Function[]> = {};

  on(event: 'open' | 'message' | 'close' | 'error', listener: (...args: unknown[]) => void): void {
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
      listener(...args);
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
