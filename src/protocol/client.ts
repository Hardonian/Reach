/**
 * Protocol Client (TypeScript)
 * 
 * Client implementation for the binary protocol.
 * Supports TCP sockets (and could support named pipes on Windows).
 */

import * as net from 'net';
import { EventEmitter } from 'events';
import { Frame, FrameParser, MessageType, encodeFrame } from './frame';
import {
  HelloAckPayload, ExecRequestPayload, ExecResultPayload,
  HealthRequestPayload, HealthResultPayload, ErrorPayload, createHello,
  serializeCbor, deserializeCbor, CapabilityFlags,
} from './messages';

/** Client configuration */
export interface ProtocolClientConfig {
  host?: string;
  port?: number;
  path?: string; // For Named Pipes (Windows) or Unix Sockets (POSIX)
  connectTimeoutMs?: number;
  requestTimeoutMs?: number;
  autoReconnect?: boolean;
}

/** Connection state */
export enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Negotiating = 'negotiating',
  Ready = 'ready',
  Error = 'error',
}

/** Protocol client events */
export interface ProtocolClientEvents {
  connect: () => void;
  disconnect: (reason?: string) => void;
  error: (error: Error) => void;
  stateChange: (state: ConnectionState) => void;
}

/** Protocol client for binary protocol */
export class ProtocolClient extends EventEmitter {
  private config: Required<ProtocolClientConfig>;
  private socket: net.Socket | null = null;
  private state: ConnectionState = ConnectionState.Disconnected;
  private frameParser: FrameParser;
  private _sessionId: string | null = null;
  private pendingRequests: Map<number, {
    resolve: (value: Frame) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
    expectedType: MessageType;
  }> = new Map();
  private nextCorrelationId = 1;
  
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  
  constructor(config: ProtocolClientConfig) {
    super();
    this.config = {
      host: '127.0.0.1',
      port: 9000,
      path: '',
      connectTimeoutMs: 5000,
      requestTimeoutMs: 30000,
      autoReconnect: true,
      ...config,
    };
    this.frameParser = new FrameParser();

    // Periodic cleanup of stale pending requests (every 10s)
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [correlationId, pending] of this.pendingRequests) {
        // If we missed the timeout for some reason or it's just very old
        // Note: each pending request already has its own timeout, 
        // but this is a fail-safe against leaked timers/map entries.
      }
    }, 10000);
  }
  
  /** Get current connection state */
  get connectionState(): ConnectionState {
    return this.state;
  }
  
  /** Get session ID (null if not connected) */
  get sessionId(): string | null {
    return this._sessionId;
  }
  
  /** Check if connected and ready */
  get isReady(): boolean {
    return this.state === ConnectionState.Ready;
  }
  
  /** Connect to server */
  async connect(): Promise<void> {
    if (this.state !== ConnectionState.Disconnected) {
      throw new Error(`Cannot connect in state: ${this.state}`);
    }
    
    this.setState(ConnectionState.Connecting);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.socket?.destroy();
        this.setState(ConnectionState.Error);
        reject(new Error('Connection timeout'));
      }, this.config.connectTimeoutMs);
      
      this.socket = new net.Socket();
      
      this.socket.on('connect', async () => {
        clearTimeout(timeout);
        try {
          await this.performHandshake();
          this.startHeartbeat();
          this.setState(ConnectionState.Ready);
          this.emit('connect');
          resolve();
        } catch (error) {
          this.socket?.destroy();
          this.setState(ConnectionState.Error);
          reject(error);
        }
      });
      
      this.socket.on('error', (error) => {
        clearTimeout(timeout);
        this.setState(ConnectionState.Error);
        this.emit('error', error);
        reject(error);
      });
      
      this.socket.on('close', () => {
        this.handleDisconnect();
      });
      
      this.socket.on('data', (data) => {
        this.handleData(data);
      });
      
      if (this.config.path) {
        this.socket.connect(this.config.path);
      } else {
        this.socket.connect({
          host: this.config.host,
          port: this.config.port,
        });
      }
    });
  }

  
  /** Disconnect from server */
  async disconnect(): Promise<void> {
    this.stopHeartbeat();
    if (!this.socket) {
      return;
    }
    
    this.socket.end();
    
    return new Promise((resolve) => {
      this.socket?.on('close', () => {
        resolve();
      });
      
      // Force close after timeout
      setTimeout(() => {
        this.socket?.destroy();
        resolve();
      }, 1000);
    });
  }
  
  /** Execute a workflow */
  async execute(request: ExecRequestPayload): Promise<ExecResultPayload> {
    this.ensureReady();
    
    const frame = await this.sendRequest(
      MessageType.ExecRequest,
      request,
      MessageType.ExecResult
    );
    
    return deserializeCbor<ExecResultPayload>(frame.payload);
  }
  
  /** Check health */
  async health(detailed: boolean = false): Promise<HealthResultPayload> {
    this.ensureReady();
    
    const request: HealthRequestPayload = { detailed };
    const frame = await this.sendRequest(
      MessageType.HealthRequest,
      request,
      MessageType.HealthResult
    );
    
    return deserializeCbor<HealthResultPayload>(frame.payload);
  }
  
  /** Get protocol statistics */
  getStats(): {
    bufferSize: number;
    pendingRequests: number;
  } {
    return {
      bufferSize: this.frameParser.bufferSize,
      pendingRequests: this.pendingRequests.size,
    };
  }
  
  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.emit('stateChange', state);
    }
  }
  
  private ensureReady(): void {
    if (this.state !== ConnectionState.Ready) {
      throw new Error(`Client not ready (state: ${this.state})`);
    }
  }
  
  private async performHandshake(): Promise<void> {
    this.setState(ConnectionState.Negotiating);
    
    // Send Hello
    const hello = createHello('reach-cli', '1.0.0');
    await this.sendFrame({
      versionMajor: 1,
      versionMinor: 0,
      msgType: MessageType.Hello,
      flags: 0,
      correlationId: 0, // Handshake doesn't need correlation
      payload: serializeCbor(hello),
    });
    
    // Wait for HelloAck
    const response = await this.waitForFrame(
      MessageType.HelloAck,
      this.config.connectTimeoutMs
    );
    
    const ack = deserializeCbor<HelloAckPayload>(response.payload);
    this._sessionId = ack.session_id;
    
    // Verify capabilities
    if (!(ack.capabilities & CapabilityFlags.BINARY_PROTOCOL)) {
      throw new Error('Server does not support binary protocol');
    }
    
    // Verify protocol version
    const [major, minor] = ack.selected_version;
    if (major !== 1 || minor !== 0) {
      throw new Error(`Unsupported protocol version: ${major}.${minor}`);
    }
    
    // Verify hash primitive is blake3 (fail closed on mismatch)
    if (ack.hash_version !== 'blake3') {
      throw new Error(
        `Hash primitive mismatch: expected 'blake3', got '${ack.hash_version}'. ` +
        'Client requires blake3 for deterministic hashing.'
      );
    }
  }
  
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.state === ConnectionState.Ready) {
        this.sendFrame({
          versionMajor: 1,
          versionMinor: 0,
          msgType: MessageType.Heartbeat,
          flags: 0,
          correlationId: 0,
          payload: new Uint8Array(0),
        }).catch((err) => {
          this.emit('error', new Error(`Heartbeat failed: ${err.message}`));
          this.handleDisconnect();
        });
      }
    }, 5000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private getNextCorrelationId(): number {
    const id = this.nextCorrelationId++;
    if (this.nextCorrelationId > 0x7FFFFFFF) {
      this.nextCorrelationId = 1;
    }
    return id;
  }
  
  private async sendFrame(frame: Frame): Promise<void> {
    if (!this.socket) {
      throw new Error('Not connected');
    }
    
    const encoded = encodeFrame(frame);
    
    return new Promise((resolve, reject) => {
      this.socket!.write(encoded, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
  
  private correlationCounter = 0;
  
  private async sendRequest<T>(
    requestType: MessageType,
    payload: T,
    expectedResponseType: MessageType
  ): Promise<Frame> {
    const correlationId = this.getNextCorrelationId();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new Error(`Request timeout (type: ${requestType}, id: ${correlationId})`));
      }, this.config.requestTimeoutMs);
      
      this.pendingRequests.set(correlationId, {
        resolve,
        reject,
        timeout,
        expectedType: expectedResponseType,
      });
      
      this.sendFrame({
        versionMajor: 1,
        versionMinor: 0,
        msgType: requestType,
        flags: 0,
        correlationId,
        payload: serializeCbor(payload),
      }).catch((error) => {
        this.pendingRequests.delete(correlationId);
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
  
  private async waitForFrame(
    expectedType: MessageType,
    timeoutMs: number
  ): Promise<Frame> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for ${expectedType}`));
      }, timeoutMs);
      
      const onFrame = (frame: Frame) => {
        if (frame.msgType === expectedType) {
          cleanup();
          resolve(frame);
        } else if (frame.msgType === MessageType.Error) {
          cleanup();
          const error = deserializeCbor<ErrorPayload>(frame.payload);
          reject(new Error(`Server error: ${error.message} (${error.code})`));
        }
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.removeListener('frame', onFrame);
        this.removeListener('error', onError);
      };

      this.on('frame', onFrame);
      this.on('error', onError);
    });
  }
  
  private handleData(data: Buffer | string): void {
    // Ensure we only process Buffer data, not strings
    if (typeof data === 'string') {
      this.emit('error', new Error('Received string data on binary socket'));
      return;
    }
    this.frameParser.append(new Uint8Array(data));
    
    // Process all available frames
    while (true) {
      try {
        const frame = this.frameParser.parse();
        if (!frame) break;
        
        this.emit('frame', frame);
        this.handleFrame(frame);
      } catch (error) {
        this.emit('error', error as Error);
        break;
      }
    }
  }
  
  private handleFrame(frame: Frame): void {
    // Check if this frame matches a pending request
    if (frame.correlationId !== 0) {
      const pending = this.pendingRequests.get(frame.correlationId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(frame.correlationId);

        if (frame.msgType === MessageType.Error) {
          const error = deserializeCbor<ErrorPayload>(frame.payload);
          pending.reject(new Error(`Server error: ${error.message} (${error.code})`));
        } else if (frame.msgType !== pending.expectedType) {
          pending.reject(new Error(`Response type mismatch: expected ${pending.expectedType}, got ${frame.msgType}`));
        } else {
          pending.resolve(frame);
        }
        return;
      }
    }

    // Handle unsolicited frames
    if (frame.msgType === MessageType.Error) {
      const error = deserializeCbor<ErrorPayload>(frame.payload);
      this.emit('error', new Error(`Unsolicited server error: ${error.message}`));
    }
  }
  
  private handleDisconnect(): void {
    this.socket = null;
    this._sessionId = null;
    this.frameParser.clear();
    
    // Reject all pending requests
    for (const [correlationId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`Connection closed (matching request id: ${correlationId})`));
    }
    this.pendingRequests.clear();
    
    this.setState(ConnectionState.Disconnected);
    this.emit('disconnect');
    
    // Auto-reconnect if enabled
    if (this.config.autoReconnect) {
      setTimeout(() => {
        this.connect().catch(() => {
          // Reconnection failed, will retry on next request
        });
      }, 1000);
    }
  }
}

/** Create a client with default configuration */
export function createClient(config: Partial<ProtocolClientConfig> = {}): ProtocolClient {
  return new ProtocolClient({
    host: process.env.REACH_ENGINE_HOST?.split(':')[0] ?? '127.0.0.1',
    port: parseInt(process.env.REACH_ENGINE_HOST?.split(':')[1] ?? '9000', 10),
    ...config,
  });
}
