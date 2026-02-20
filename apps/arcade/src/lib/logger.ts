import { env } from './env';
import { sanitize } from './sanitize';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  correlationId?: string;
  context?: Record<string, unknown>;
  error?: unknown;
}

const isServer = typeof window === 'undefined';

function formatLog(entry: LogEntry): { msg: string; args: any[] } {
  // Deep clone and sanitize
  const sanitized = sanitize(JSON.parse(JSON.stringify(entry))) as LogEntry;
  
  if (isServer && env.NODE_ENV === 'production') {
    return { msg: JSON.stringify(sanitized), args: [] };
  }
  
  if (isServer) {
    const color = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
    }[entry.level];
    const reset = '\x1b[0m';
    const ctxStr = sanitized.context ? ` ${JSON.stringify(sanitized.context)}` : '';
    const errStr = entry.error ? `\n${entry.error instanceof Error ? entry.error.stack : String(entry.error)}` : '';
    const corr = sanitized.correlationId ? ` [${sanitized.correlationId}]` : '';
    return { msg: `${color}${sanitized.level.toUpperCase()}${reset} ${sanitized.timestamp}${corr}: ${sanitized.message}${ctxStr}${errStr}`, args: [] };
  }

  // Browser pretty print
  const args: any[] = [];
  const color = {
    debug: 'color: #00bcd4',
    info: 'color: #4caf50',
    warn: 'color: #ff9800',
    error: 'color: #f44336',
  }[entry.level];
  
  const msg = `%c${sanitized.level.toUpperCase()}%c ${sanitized.message}`;
  args.push(color, 'color: inherit');
  if (sanitized.context) args.push(sanitized.context);
  if (entry.error) args.push(entry.error); // Error objects often don't JSON.stringify well
  if (sanitized.correlationId) args.push({ correlationId: sanitized.correlationId });

  return { msg, args };
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: unknown, correlationId?: string) {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
    error,
    correlationId,
  };

  const { msg, args } = formatLog(entry);
  
  switch (level) {
    case 'debug': console.debug(msg, ...args); break;
    case 'info': console.info(msg, ...args); break;
    case 'warn': console.warn(msg, ...args); break;
    case 'error': console.error(msg, ...args); break;
  }
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>, corrId?: string) => log('debug', msg, ctx, undefined, corrId),
  info: (msg: string, ctx?: Record<string, unknown>, corrId?: string) => log('info', msg, ctx, undefined, corrId),
  warn: (msg: string, ctx?: Record<string, unknown>, corrId?: string) => log('warn', msg, ctx, undefined, corrId),
  error: (msg: string, error?: unknown, ctx?: Record<string, unknown>, corrId?: string) => log('error', msg, ctx, error, corrId),
};
