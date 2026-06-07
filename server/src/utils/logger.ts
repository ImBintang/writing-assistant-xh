// server/src/utils/logger.ts

import path from 'path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const LOG_DIR = path.resolve(process.cwd(), 'workspace', 'logs');

// ==================== API Key Sanitization ====================

/**
 * Patterns that match API key formats from various providers.
 * Matches are replaced with [REDACTED] to prevent key leaks in log files.
 */
const API_KEY_PATTERNS: Array<RegExp> = [
  /sk-ant-(?:api\d{2,4}-)?[A-Za-z0-9_-]{20,}/g,  // Anthropic keys
  /sk-[A-Za-z0-9_-]{20,}/g,                        // OpenAI keys
  /AIza[A-Za-z0-9_-]{20,}/g,                        // Google AI keys
  /"(?:ANTHROPIC_API_KEY|OPENAI_API_KEY|OLLAMA_API_KEY)"\s*:\s*"[^"]+"/gi, // JSON key-value pairs
  /(?:api_key|apikey|api-key|secret|token|password)\s*[:=]\s*['"][^'"]+['"]/gi, // Generic key assignments
  /(?:ANTHROPIC_API_KEY|OPENAI_API_KEY|OLLAMA_API_KEY)\s*=\s*[^\s,;]+/gi,       // Env var assignments
];

/**
 * Sanitize a log message by redacting any API key patterns.
 */
export function sanitizeLogMessage(message: string): string {
  let sanitized = message;
  for (const pattern of API_KEY_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      // Preserve the key name/prefix but redact the value
      const eqIdx = match.search(/[:=]/);
      if (eqIdx > 0) {
        return match.slice(0, eqIdx + 1) + ' [REDACTED]';
      }
      return '[REDACTED]';
    });
  }
  return sanitized;
}

// ==================== Winston Setup ====================

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, module }) => {
    const moduleStr = module ? `[${module}]` : '';
    const sanitizedMessage = sanitizeLogMessage(
      typeof message === 'string' ? message : String(message),
    );
    return `[${timestamp}] [${level.toUpperCase()}] ${moduleStr} ${sanitizedMessage}`;
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
