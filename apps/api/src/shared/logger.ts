// ============================================================
// LOGGER
// Structured JSON logger for production, pretty-print for dev.
// All services and jobs use this instead of console.log.
// ============================================================

import { env } from '../config/env'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level:   LogLevel
  message: string
  ts:      string
  [key: string]: unknown
}

function write(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    ts: new Date().toISOString(),
    ...meta,
  }

  const output = env.NODE_ENV === 'production'
    ? JSON.stringify(entry)
    : `[${entry.ts}] ${level.toUpperCase().padEnd(5)} ${message}${meta ? ' ' + JSON.stringify(meta) : ''}`

  if (level === 'error') {
    console.error(output)
  } else if (level === 'warn') {
    console.warn(output)
  } else {
    console.log(output)
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => write('debug', message, meta),
  info:  (message: string, meta?: Record<string, unknown>) => write('info',  message, meta),
  warn:  (message: string, meta?: Record<string, unknown>) => write('warn',  message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),
}
