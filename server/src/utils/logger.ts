// server/src/utils/logger.ts

import path from 'path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const LOG_DIR = path.resolve(process.cwd(), 'workspace', 'logs');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, module }) => {
    const moduleStr = module ? `[${module}]` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${moduleStr} ${message}`;
  }),
);

function createLogger(moduleName: string): winston.Logger {
  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), logFormat),
    }),
  ];

  // File transport with daily rotation (skip in test environment)
  if (process.env.NODE_ENV !== 'test') {
    transports.push(
      new DailyRotateFile({
        dirname: LOG_DIR,
        filename: 'app-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: '30d',
        maxSize: '20m',
        format: logFormat,
      }),
    );
  }

  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'debug',
    defaultMeta: { module: moduleName },
    transports,
  });
}

// Shared logger instances
export const appLogger = createLogger('app');
export const sandboxLogger = createLogger('sandbox');
export const configLogger = createLogger('config');

export { createLogger };
export default appLogger;
