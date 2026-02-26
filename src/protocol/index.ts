/**
 * Reach Binary Protocol (TypeScript)
 * 
 * Client implementation for the Requiem binary protocol.
 * 
 * @example
 * ```typescript
 * import { createClient, createHello, Duration } from './protocol';
 * 
 * const client = createClient({ host: '127.0.0.1', port: 9000 });
 * await client.connect();
 * 
 * const result = await client.execute({
 *   run_id: 'run-123',
 *   workflow: { name: 'test', version: '1.0', steps: [] },
 *   controls: {
 *     step_timeout_us: Duration.fromSeconds(30),
 *     run_timeout_us: Duration.fromMinutes(5),
 *     budget_limit_usd: q32_32FromF64(10.0),
 *     min_step_interval_us: Duration.ZERO,
 *   },
 *   policy: { rules: [], default_decision: { type: 'allow' } },
 *   metadata: {},
 * });
 * 
 * console.log('Result digest:', result.result_digest);
 * ```
 */

// Frame codec
export {
  MAGIC,
  MAX_PAYLOAD_BYTES,
  HEADER_SIZE,
  FOOTER_SIZE,
  FRAME_OVERHEAD,
  PROTOCOL_VERSION_MAJOR,
  PROTOCOL_VERSION_MINOR,
  FrameFlags,
  MessageType,
  Frame,
  FrameError,
  FrameParser,
  encodeFrame,
  decodeFrame,
} from './frame';

// Message types
export {
  // Fixed-point types
  FixedQ32_32,
  q32_32FromF64,
  q32_32ToF64,
  FixedBps,
  bpsFromPercent,
  bpsToPercent,
  FixedPpm,
  ppmFromRatio,
  ppmToRatio,
  FixedDuration,
  Duration,
  FixedThroughput,
  throughputFromOpsPerSec,
  throughputToOpsPerSec,
  
  // Capabilities
  CapabilityFlags,
  
  // Payloads
  HelloPayload,
  HelloAckPayload,
  Workflow,
  WorkflowStep,
  ExecutionControls,
  Policy,
  PolicyRule,
  PolicyCondition,
  Decision,
  ExecRequestPayload,
  ExecResultPayload,
  RunStatus,
  RunEvent,
  Action,
  ExecutionMetrics,
  Histogram,
  HealthRequestPayload,
  HealthResultPayload,
  HealthStatus,
  LoadMetrics,
  ErrorPayload,
  ErrorCode,
  
  // Helpers
  createHello,
  serializeCbor,
  deserializeCbor,
  serializeJson,
  deserializeJson,
} from './messages';

// Client
export {
  ProtocolClientConfig,
  ConnectionState,
  ProtocolClient,
  createClient,
} from './client';
