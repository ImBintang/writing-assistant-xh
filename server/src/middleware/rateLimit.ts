// server/src/middleware/rateLimit.ts
// Rate limiting middleware using express-rate-limit
// - Global: 120 requests/min per IP
// - AI endpoints: 10 requests/min per IP
// - Upload: 5 requests/min per IP
//
// NOTE: We disable xForwardedForHeader validation since we handle
// proxied IPs ourselves in a controlled local environment.

import rateLimit from 'express-rate-limit';

const RATE_LIMIT_MESSAGE = '请求过于频繁，请稍后再试';

const rateLimitConfig = {
  message: {
    error: {
      message: RATE_LIMIT_MESSAGE,
      status: 429,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false } as any,
};

/**
 * Global rate limiter — 120 requests per minute per IP.
 * Applied to all routes.
 */
export const globalLimiter = rateLimit({
  ...rateLimitConfig,
  windowMs: 60 * 1000,
  max: 120,
});

/**
 * AI endpoint rate limiter — 10 requests per minute per IP.
 * Applied to /api/v1/extract, /api/v1/writing, /api/v1/brainstorm
 */
export const aiLimiter = rateLimit({
  ...rateLimitConfig,
  windowMs: 60 * 1000,
  max: 10,
  message: {
    error: {
      message: 'AI 请求过于频繁，请稍后再试',
      status: 429,
    },
  },
});

/**
 * Upload endpoint rate limiter — 5 requests per minute per IP.
 * Applied to /api/v1/chapters/upload
 */
export const uploadLimiter = rateLimit({
  ...rateLimitConfig,
  windowMs: 60 * 1000,
  max: 5,
  message: {
    error: {
      message: '上传请求过于频繁，请稍后再试',
      status: 429,
    },
  },
});
