import * as vscode from 'vscode';
import WebSocket from 'ws';

type MessageHandler = (payload: unknown) => void;
type StatusHandler = (connected: boolean) => void;

export interface BridgeClientOptions {
  getUrl: () => string;
  onMessage?: MessageHandler;
  onStatusChange?: StatusHandler;
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  webSocketFactory?: (url: string) => WebSocketLike;
}

export interface WebSocketLike {
  on(event: 'open', listener: () => void): void;
  on(event: 'message', listener: (data: WebSocket.RawData) => void): void;
  on(event: 'close', listener: () => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  send(data: string): void;
  close(): void;
}

export class BridgeClient implements vscode.Disposable {
  private readonly getUrl: () => string;
  private readonly onMessage?: MessageHandler;
  private readonly onStatusChange?: StatusHandler;
  private readonly reconnectDelayMs: number;
  private readonly maxReconnectDelayMs: number;
  private readonly webSocketFactory: (url: string) => WebSocketLike;
  private socket: WebSocketLike | undefined;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private currentDelayMs: number;
  private disposed = false;

  constructor(options: BridgeClientOptions) {
    this.getUrl = options.getUrl;
    this.onMessage = options.onMessage;
    this.onStatusChange = options.onStatusChange;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 1000;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs ?? 15000;
    this.currentDelayMs = this.reconnectDelayMs;
    this.webSocketFactory = options.webSocketFactory ?? ((url) => new WebSocket(url));
  }

  connect(): void {
    if (this.disposed || this.socket) {
      return;
    }

    const socket = this.webSocketFactory(this.getUrl());
    this.socket = socket;

    socket.on('open', () => {
      this.currentDelayMs = this.reconnectDelayMs;
      this.onStatusChange?.(true);
    });

    socket.on('message', (rawData) => {
      try {
        const content = typeof rawData === 'string' ? rawData : rawData.toString();
        const parsed: unknown = JSON.parse(content);
        this.onMessage?.(parsed);
      } catch {
        // Ignore malformed bridge messages.
      }
    });

    socket.on('close', () => {
      this.socket = undefined;
      this.onStatusChange?.(false);
      this.scheduleReconnect();
    });

    socket.on('error', () => {
      this.socket?.close();
    });
  }

  send(payload: unknown): boolean {
    if (!this.socket) {
      return false;
    }

    this.socket.send(JSON.stringify(payload));
    return true;
  }

  forceReconnect(): void {
    this.socket?.close();
    this.clearReconnectTimer();
    this.connect();
  }

  dispose(): void {
    this.disposed = true;
    this.clearReconnectTimer();
    this.socket?.close();
    this.socket = undefined;
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.reconnectTimer) {
      return;
    }

    const delay = this.currentDelayMs;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.currentDelayMs = Math.min(this.currentDelayMs * 2, this.maxReconnectDelayMs);
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }
}
