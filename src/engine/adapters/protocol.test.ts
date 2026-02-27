import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProtocolEngineAdapter } from './protocol';
import { FuzzGenerator } from './base';

// Mock the ProtocolClient to isolate adapter logic
vi.mock('../../protocol/client', async () => {
  const { MockProtocolClient, ConnectionState } = await import('../../../tests/mocks/protocol-client');
  return {
    ProtocolClient: MockProtocolClient,
    ConnectionState,
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

  it('logs request payload when logger is provided', async () => {
    const logger = vi.fn();
    adapter = new ProtocolEngineAdapter({
      client: { host: '127.0.0.1', port: 9000 },
      logger
    });
    
    // Initialize adapter to set up client mock
    await adapter.configure();
    
    const request = FuzzGenerator.generateValidRequest();
    await adapter.evaluate(request);
    
    expect(logger).toHaveBeenCalledWith(expect.stringContaining('[ProtocolAdapter]'), expect.objectContaining({ run_id: request.requestId }));
  });
});