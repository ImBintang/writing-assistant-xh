// server/src/sandbox/policies.ts
// Security policy definitions for file operations and upload restrictions

import path from 'path';

/**
 * Files that are protected from direct API write/delete operations.
 * These can only be modified by the sandbox manager internally.
 */
export const SYSTEM_FILES = new Set([
  '.workspace.lock',
  '_meta.json',
  'user-config.json',
]);

/**
 * Allowed file extensions for user uploads.
 */
export const ALLOWED_UPLOAD_EXTENSIONS = new Set(['.txt', '.md', '.json']);

/**
 * Check if a given path targets a system-protected file.
 * Matches the basename against the SYSTEM_FILES set.
 *
 * @param targetPath - An absolute or relative file path
 * @returns true if the path refers to a system file
 */
export function isSystemFile(targetPath: string): boolean {
  const basename = path.basename(targetPath);
  return SYSTEM_FILES.has(basename);
}

/**
 * Check if a filename has an allowed extension for upload.
 *
 * @param filename - The original filename (e.g. "document.txt")
 * @returns true if the extension is in the allowed list
 */
export function isAllowedUploadType(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_UPLOAD_EXTENSIONS.has(ext);
}

/**
 * Validate that a filename does not contain path separators or traversal sequences.
 * Used to prevent path injection via filename parameters.
 *
 * @param name - The filename to validate
 * @throws Error with statusCode 400 if the name is invalid
 */
export function validateFilename(name: string): void {
  if (!name || typeof name !== 'string') {
    const err = new Error('文件名不能为空');
    (err as any).statusCode = 400;
    throw err;
  }

  if (name.includes('/') || name.includes('\\')) {
    const err = new Error(`文件名不能包含路径分隔符: ${name}`);
    (err as any).statusCode = 400;
    throw err;
  }

  if (name.includes('..')) {
    const err = new Error(`文件名不能包含路径穿越序列: ${name}`);
    (err as any).statusCode = 400;
    throw err;
  }

  // Reject null bytes (path truncation attacks)
  if (name.includes('\0')) {
    const err = new Error(`文件名包含非法字符`);
    (err as any).statusCode = 400;
    throw err;
  }
}

/**
 * System file patterns that should never be accessible via API routes.
 * Used for directory listing filtering.
 */
export const HIDDEN_FILE_PATTERNS = [
  /^\./,           // Hidden files (Unix)
  /^_meta\.json$/, // Chapter meta files
  /^user-config\.json$/,
];

/**
 * Check if a file should be hidden from API directory listings.
 */
export function isHiddenFile(filename: string): boolean {
  return HIDDEN_FILE_PATTERNS.some((pattern) => pattern.test(filename));
}
