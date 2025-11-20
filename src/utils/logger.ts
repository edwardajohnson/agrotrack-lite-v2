// src/utils/logger.ts

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'debug' | 'success';
  message: string;
  data?: any;
  agent?: string;
  ref?: string;
}

const logBuffer: LogEntry[] = [];
const MAX_LOGS = 1000;

export function log(
  message: string,
  level: 'info' | 'error' | 'debug' | 'success' = 'info',
  data?: any
): void {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data,
  };

  // Extract agent and ref from data if present
  if (data?.agent) logEntry.agent = data.agent;
  if (data?.ref) logEntry.ref = data.ref;

  // Console output with colors
  const emoji = {
    info: '📘',
    error: '❌',
    debug: '🔍',
    success: '✅',
  }[level];

  console.log(`${emoji} [${logEntry.timestamp}] [${level.toUpperCase()}] ${message}`, data || '');

  // Store in buffer
  logBuffer.push(logEntry);
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.shift();
  }
}

export function getLogs(limit: number = 100): LogEntry[] {
  return logBuffer.slice(-limit);
}

export function getLogStats() {
  return {
    total: logBuffer.length,
    byLevel: {
      info: logBuffer.filter(l => l.level === 'info').length,
      error: logBuffer.filter(l => l.level === 'error').length,
      debug: logBuffer.filter(l => l.level === 'debug').length,
      success: logBuffer.filter(l => l.level === 'success').length,
    },
    byAgent: logBuffer.reduce((acc, l) => {
      if (l.agent) {
        acc[l.agent] = (acc[l.agent] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>),
  };
}

export function clearLogs(): void {
  logBuffer.length = 0;
}
