import fs from 'fs';
import path from 'path';
import { LogEvent } from '../orchestrator/interfaces';

const logFilePath = path.join(process.cwd(), 'logs', 'events.log');

// Ensure log directory exists
const logDir = path.dirname(logFilePath);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

function log(level: LogEvent['level'], message: string, details: Record<string, any> = {}): void {
  const logEvent: LogEvent = {
    timestamp: new Date().toISOString(),
    level,
    message,
    details,
  };

  const logLine = JSON.stringify(logEvent) + '\\n';

  // Write to file
  logStream.write(logLine);

  // Write to stdout
  console.log(logLine.trim());
}

export const logger = {
  info: (message: string, details?: Record<string, any>) => log('info', message, details),
  warn: (message: string, details?: Record<string, any>) => log('warn', message, details),
  error: (message: string, details?: Record<string, any>) => log('error', message, details),
  debug: (message: string, details?: Record<string, any>) => log('debug', message, details),
};