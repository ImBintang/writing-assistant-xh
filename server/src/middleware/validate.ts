// server/src/middleware/validate.ts
// Input validation and sanitization middleware
// - XSS sanitization for string inputs
// - Filename parameter validation
// - Text length validation for AI operations

import { Request, Response, NextFunction } from 'express';
import { appLogger } from '../utils/logger';

/**
 * Patterns that indicate potentially dangerous XSS or script injection.
 * These are stripped from input strings.
 */
const XSS_PATTERNS: Array<[RegExp, string]> = [
  [/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ''],
  [/<script\b/gi, ''],
  [/onerror\s*=/gi, ''],
  [/onload\s*=/gi, ''],
  [/onclick\s*=/gi, ''],
  [/onmouseover\s*=/gi, ''],
  [/onfocus\s*=/gi, ''],
  [/onblur\s*=/gi, ''],
  [/onchange\s*=/gi, ''],
  [/onsubmit\s*=/gi, ''],
  [/onkeyup\s*=/gi, ''],
  [/onkeydown\s*=/gi, ''],
  [/eval\s*\(/gi, ''],
  [/javascript\s*:/gi, ''],
  [/<iframe\b/gi, ''],
  [/<embed\b/gi, ''],
  [/<object\b/gi, ''],
  [/<link\b/gi, ''],
];

/**
 * Strip potentially dangerous XSS patterns from a string.
 * Returns the sanitized string (or the original if unchanged).
 * Logs a warning when sanitization is applied.
 *
 * @param value - The input string to sanitize
 * @returns The sanitized string
 */
export function sanitizeString(value: string): string {
  if (!value || typeof value !== 'string') return value;

  let sanitized = value;
  let changed = false;

  for (const [pattern, replacement] of XSS_PATTERNS) {
    if (pattern.test(sanitized)) {
      sanitized = sanitized.replace(pattern, replacement as string);
      changed = true;
    }
  }

  if (changed) {
    appLogger.warn(
      `XSS sanitization applied to input (length=${value.length}): removed potentially dangerous patterns`,
    );
  }

  return sanitized;
}

/**
 * Validate that a filename parameter does not contain path separators,
 * traversal sequences, or null bytes.
 * Throws a 400 error if validation fails.
 *
 * @param value - The filename to validate
 */
export function validateFilenameParam(value: string): void {
  if (!value || typeof value !== 'string') {
    const err = new Error('文件名不能为空');
    (err as any).statusCode = 400;
    throw err;
  }

  if (value.includes('/') || value.includes('\\')) {
    const err = new Error(`文件名不能包含路径分隔符: ${value}`);
    (err as any).statusCode = 400;
    throw err;
  }

  if (value.includes('..')) {
    const err = new Error(`文件名不能包含路径穿越序列: ${value}`);
    (err as any).statusCode = 400;
    throw err;
  }

  if (value.includes('\0')) {
    const err = new Error('文件名包含非法字符');
    (err as any).statusCode = 400;
    throw err;
  }
}

/**
 * Validate that text input does not exceed a maximum character length.
 * Used for AI operation inputs to prevent context overflow.
 *
 * @param value - The text to check
 * @param maxChars - Maximum allowed characters (default: 50000)
 */
export function validateTextLength(value: string, maxChars: number = 50000): void {
  if (value && value.length > maxChars) {
    const err = new Error(`输入文本超过最大长度限制 (${maxChars} 字符)`);
    (err as any).statusCode = 400;
    throw err;
  }
}

/**
 * Express middleware factory that sanitizes specified body fields.
 * Sanitization is applied to fields at the top level and in nested objects.
 *
 * @param fields - Array of field names to sanitize in req.body
 * @returns Express middleware function
 */
export function sanitizeMiddleware(fields: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.body || typeof req.body !== 'object') {
      return next();
    }

    for (const field of fields) {
      if (typeof req.body[field] === 'string') {
        req.body[field] = sanitizeString(req.body[field]);
      }
    }

    next();
  };
}
