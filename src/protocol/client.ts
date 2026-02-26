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
  HelloPayload, HelloAckPayload, ExecRequestPayload, ExecResultPayload,
  HealthRequestPayload, HealthResultPayload, ErrorPayload, createHello,
  serializeCbor, deserializeCbor, CapabilityFlags,
} from './messages';

/** Client configuration */
export interface ProtocolClientConfig {
  host: string;
  port: number;
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
  private pendingRequests: Map<string, {
    resolve: (value: Frame) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  
  constructor(config: ProtocolClientConfig) {
    super();
    this.config = {
      connectTimeoutMs: 5000,
      requestTimeoutMs: 30000,
      autoReconnect: true,
      ...config,
    };
    this.frameParser = new FrameParser();
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
      
      this.socket.connect({
        host: this.config.host,
        port: this.config.port,
      });
    });
  }
  
  /** Disconnect from server */
  async disconnect(): Promise<void> {
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
  
  private async sendRequest<T>(
    requestType: MessageType,
    payload: T,
    expectedResponseType: MessageType
  ): Promise<Frame> {
    const correlationId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    return new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new Error('Request timeout'));
      }, this.config.requestTimeoutMs);
      
      // Store pending request
      this.pendingRequests.set(correlationId, {
        resolve: (frame) => {
          clearTimeout(timeout);
          resolve(frame);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
      });
      
      // Send request
      this.sendFrame({
        versionMajor: 1,
        versionMinor: 0,
        msgType: requestType,
        flags: 0,
        payload: serializeCbor(payload),
      }).catch((error) => {
        this.pendingRequests.delete(correlationId);
        clearTimeout(timeout);
        reject(error);
      });
      
      // Wait for response
      this.waitForResponse(expectedResponseType, correlationId)
        .then(resolve)
        .catch(reject);
    });
  }
  
  private async waitForFrame(
    expectedType: MessageType,
    timeoutMs: number
  ): Promise<Frame> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${expectedType}`));
      }, timeoutMs);
      
      const checkFrame = () => {
        const frame = this.frameParser.parse();
        if (frame) {
          if (frame.msgType === expectedType) {
            clearTimeout(timeout);
            resolve(frame);
            return;
          } else if (frame.msgType === MessageType.Error) {
            clearTimeout(timeout);
            const error = deserializeCbor<ErrorPayload>(frame.payload);
            reject(new Error(`Server error: ${error.message} (${error.code})`));
            return;
          }
        }
        
        // Check again soon
        setTimeout(checkFrame, 10);
      };
      
      checkFrame();
    });
  }
  
  private async waitForResponse(
    expectedType: MessageType,
    correlationId: string
  ): Promise<Frame> {
    const pending = this.pendingRequests.get(correlationId);
    if (!pending) {
      throw new Error('Request not found');
    }
    
    return new Promise((resolve, reject) => {
      const checkResponse = () => {
        // This is simplified - in reality we'd correlate by ID
        // For now, just wait for any matching response type
        const frame = this.frameParser.parse();
        if (frame) {
          if (frame.msgType === expectedType) {
            this.pendingRequests.delete(correlationId);
            resolve(frame);
            return;
          } else if (frame.msgType === MessageType.Error) {
            this.pendingRequests.delete(correlationId);
            const error = deserializeCbor<ErrorPayload>(frame.payload);
            reject(new Error(`Server error: ${error.message} (${error.code})`));
            return;
          }
        }
        
        setTimeout(checkResponse, 10);
      };
      
      checkResponse();
    });
  }
  
  private handleData(data: Buffer): void {
    this.frameParser.append(new Uint8Array(data));
    
    // Process all available frames
    while (true) {
      try {
        const frame = this.frameParser.parse();
        if (!frame) break;
        
        this.handleFrame(frame);
      } catch (error) {
        this.emit('error', error as Error);
      }
    }
  }
  
  private handleFrame(frame: Frame): void {
    // Handle unsolicited frames (errors, etc.)
    if (frame.msgType === MessageType.Error) {
      const error = deserializeCbor<ErrorPayload>(frame.payload);
      this.emit('error', new Error(`Server error: ${error.message}`));
    }
  }
  
  private handleDisconnect(): void {
    this.socket = null;
    this._sessionId = null;
    this.frameParser.clear();
    
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
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
