import winston from 'winston';

import { InkLogger } from '@/ui/logger.js';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
  return `${String(timestamp)} [${String(level)}]: ${String(message)} ${metaStr}`;
});

const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat,
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
  ],
});

export const logger = InkLogger.create(winstonLogger);

export function setLogLevel(level: string): void {
  logger.level = level;
}

export function enableDebugMode(): void {
  setLogLevel('debug');
}