import { vi } from 'vitest';

export const ConnectionState = {
  Disconnected: 'disconnected',
  Connecting: 'connecting',
  Ready: 'ready',
  Failed: 'failed',
} as const;

export class MockProtocolClient {
  public isReady = false;
  public connectionState: typeof ConnectionState[keyof typeof ConnectionState] = ConnectionState.Disconnected;
  public config: unknown;

  constructor(config: unknown) {
    this.config = config;
  }

  public connect = vi.fn().mockImplementation(async () => {
    this.isReady = true;
    this.connectionState = ConnectionState.Ready;
    return Promise.resolve();
  });

  public disconnect = vi.fn().mockImplementation(async () => {
    this.isReady = false;
    this.connectionState = ConnectionState.Disconnected;
    return Promise.resolve();
  });

  public execute = vi.fn().mockResolvedValue({
    run_id: 'mock-run-id',
    status: { type: 'completed' },
    result_digest: 'blake3:mock-digest',
    events: [],
    metrics: { elapsed_us: 1000 },
    final_action: { type: 'done' }
  });

  public health = vi.fn().mockResolvedValue({
    status: { type: 'healthy' },
    version: '1.0.0'
  });

  public getStats = vi.fn().mockReturnValue({
    pendingRequests: 0
  });
}