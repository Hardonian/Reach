import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProtocolEngineAdapter } from './protocol';
import { FuzzGenerator } from './base';

// Mock the ProtocolClient to isolate adapter logic
vi.mock('../../protocol/client', () => {
  return {
    ProtocolClient: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue({
        run_id: 'test-id',
        status: { type: 'completed' },
        result_digest: 'blake3:mock-digest',
        events: [],
        metrics: { elapsed_us: 1000 },
        final_action: { type: 'done' }
      }),
      isReady: true,
    })),
    ConnectionState: {
      Ready: 'ready',
      Disconnected: 'disconnected'
    }
  };
});

describe('ProtocolEngineAdapter', () => {
  let adapter: ProtocolEngineAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new ProtocolEngineAdapter({
      client: { host: '127.0.0.1', port: 9000 }
    });
  });

  it('validateInput prevents execution of requests with floating point values', async () => {
    const request = FuzzGenerator.generateFloatRequest();
    
    // Test validateInput directly
    const validation = adapter.validateInput(request);
    expect(validation.valid).toBe(false);
    expect(validation.errors?.[0]).toContain('floating_point_values_detected');

    // Test evaluate flow - should return error without calling client.execute
    const result = await adapter.evaluate(request);
    expect(result.status).toBe('error');
    expect(result.error).toContain('floating_point_values_detected');
  });

  it('allows valid integer requests', async () => {
    const request = FuzzGenerator.generateValidRequest();
    
    const validation = adapter.validateInput(request);
    expect(validation.valid).toBe(true);
    
    // Initialize adapter to set up client mock
    await adapter.configure();
    
    const result = await adapter.evaluate(request);
    expect(result.status).not.toBe('error');
  });
});