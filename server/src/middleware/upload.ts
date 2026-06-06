// server/src/middleware/upload.ts

import multer from 'multer';
import path from 'path';

const ALLOWED_EXTENSIONS = ['.txt'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      const err = new Error('仅支持 .txt 文件格式');
      (err as any).code = 'INVALID_FILE_TYPE';
      (err as any).statusCode = 400;
      cb(err);
      return;
    }
    cb(null, true);
  },
});

export const uploadMiddleware = upload.single('file');

/**
 * Normalize multer-specific errors to include a statusCode
 * so the global error handler can return the correct HTTP status.
 */
export function normalizeMulterError(err: any): void {
  if (err.code === 'LIMIT_FILE_SIZE') {
    err.statusCode = 413;
    err.message = '文件大小超过限制（最大 50MB）';
  } else if (err.code === 'INVALID_FILE_TYPE') {
    err.statusCode = 400;
  }
}
