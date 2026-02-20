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

function formatLog(entry: LogEntry): string {
  if (env.NODE_ENV === 'production') {
    // Structured JSON logging in production
    return JSON.stringify(sanitize(entry));
  }
  
  // Pretty printing in development
  const color = {
    debug: '\x1b[36m', // Cyan
    info: '\x1b[32m',  // Green
    warn: '\x1b[33m',  // Yellow
    error: '\x1b[31m', // Red
  }[entry.level];
  const reset = '\x1b[0m';
  
  const ctxStr = entry.context ? ` ${JSON.stringify(sanitize(entry.context))}` : '';
  const errStr = entry.error ? `\n${entry.error instanceof Error ? entry.error.stack : String(entry.error)}` : '';
  const corr = entry.correlationId ? ` [${entry.correlationId}]` : '';

  return `${color}${entry.level.toUpperCase()}${reset} ${entry.timestamp}${corr}: ${entry.message}${ctxStr}${errStr}`;
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

  const output = formatLog(entry);
  
  switch (level) {
    case 'debug': console.debug(output); break;
    case 'info': console.info(output); break;
    case 'warn': console.warn(output); break;
    case 'error': console.error(output); break;
  }
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>, corrId?: string) => log('debug', msg, ctx, undefined, corrId),
  info: (msg: string, ctx?: Record<string, unknown>, corrId?: string) => log('info', msg, ctx, undefined, corrId),
  warn: (msg: string, ctx?: Record<string, unknown>, corrId?: string) => log('warn', msg, ctx, undefined, corrId),
  error: (msg: string, error?: unknown, ctx?: Record<string, unknown>, corrId?: string) => log('error', msg, ctx, error, corrId),
};
