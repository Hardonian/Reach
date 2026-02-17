declare module 'ws' {
  type MessageData = string | Buffer | ArrayBuffer | Buffer[];

  export default class WebSocket {
    constructor(url: string);
    on(event: 'open', listener: () => void): void;
    on(event: 'message', listener: (data: MessageData) => void): void;
    on(event: 'close', listener: () => void): void;
    on(event: 'error', listener: (error: Error) => void): void;
    send(data: string): void;
    close(): void;
  }
}
