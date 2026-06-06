// server/src/utils/file.ts

import fs from 'fs/promises';
import path from 'path';
import { sandboxLogger } from './logger';
import { isSystemFile } from '../sandbox/policies';

// Resolved at module load time
let workspaceRoot: string = '';

export function setWorkspaceRoot(root: string): void {
  workspaceRoot = path.resolve(root);
}

export function getWorkspaceRoot(): string {
  return workspaceRoot;
}

/**
 * Resolve the real path of a target, following symlinks.
 *
 * For paths that exist on disk, uses fs.realpath() to resolve symlinks.
 * For paths that do NOT exist yet (e.g., new file writes), resolves the
 * closest existing parent directory with realpath, then joins the remainder.
 *
 * This prevents symlink-based path traversal bypasses where a symlink inside
 * the workspace points outside it.
 */
async function resolveRealPath(targetPath: string): Promise<string> {
  try {
    // Try full realpath first (file exists)
    return await fs.realpath(targetPath);
  } catch {
    // File doesn't exist — walk up to find the first existing ancestor
    let current = targetPath;
    const missingParts: string[] = [];

    while (true) {
      try {
        const real = await fs.realpath(current);
        // Rejoin with any missing parts
        return path.join(real, ...missingParts.reverse());
      } catch {
        const parent = path.dirname(current);
        if (parent === current) {
          // Reached root — fall back to path.resolve
          return path.resolve(targetPath);
        }
        missingParts.push(path.basename(current));
        current = parent;
      }
    }
  }
}

/**
 * Validate that a target path is within the workspace.
 *
 * First resolves '..' segments via path.resolve, then follows symlinks
 * via fs.realpath (for existing paths) or parent-directory realpath
 * (for paths that don't exist yet), and finally checks that the resulting
 * absolute path is within the workspace root.
 */
export async function validatePathAsync(targetPath: string): Promise<string> {
  if (!workspaceRoot) {
    throw new Error('Workspace root not initialized. Call setWorkspaceRoot() first.');
  }

  // Step 1: Resolve relative segments (../ etc.)
  const resolved = path.resolve(workspaceRoot, targetPath);

  // Step 2: Resolve symlinks
  const realPath = await resolveRealPath(resolved);

  // Step 3: Normalize separators for reliable prefix checking on Windows
  const normalizedRoot = workspaceRoot.replace(/\\/g, '/');
  const normalizedReal = realPath.replace(/\\/g, '/');

  // Step 4: Prefix check — real path must be within workspace root
  if (
    normalizedReal !== normalizedRoot &&
    !normalizedReal.startsWith(normalizedRoot + '/')
  ) {
    sandboxLogger.warn(`Path traversal attempt blocked: "${targetPath}" → "${realPath}"`);
    const err = new Error(`路径 "${targetPath}" 超出工作区范围`);
    (err as any).statusCode = 403;
    throw err;
  }

  return realPath;
}

/**
 * Synchronous wrapper for validatePathAsync.
 * Uses path.resolve for normalization and does NOT resolve symlinks.
 * Use this for simple path checks; prefer validatePathAsync for security-critical
 * operations (reads, writes, deletes).
 */
export function validatePath(targetPath: string): string {
  if (!workspaceRoot) {
    throw new Error('Workspace root not initialized. Call setWorkspaceRoot() first.');
  }

  const resolved = path.resolve(workspaceRoot, targetPath);

  // Normalize separators for reliable prefix checking on Windows
  const normalizedRoot = workspaceRoot.replace(/\\/g, '/') + '/';
  const normalizedResolved = resolved.replace(/\\/g, '/') + '/';

  if (!normalizedResolved.startsWith(normalizedRoot)) {
    sandboxLogger.warn(`Path traversal attempt blocked: ${targetPath}`);
    const err = new Error(`路径 "${targetPath}" 超出工作区范围`);
    (err as any).statusCode = 403;
    throw err;
  }

  return resolved;
}

// ==================== Public File Operations ====================
// All operations validate the path against the workspace boundary.
// writeFile and deleteFile additionally check for system file protection.

export async function readFile(relativePath: string): Promise<string> {
  const safePath = await validatePathAsync(relativePath);
  sandboxLogger.debug(`Reading file: ${safePath}`);
  return fs.readFile(safePath, 'utf-8');
}

export async function writeFile(relativePath: string, content: string): Promise<void> {
  // Check system file protection first
  if (isSystemFile(relativePath)) {
    sandboxLogger.warn(`Blocked write to system file: ${relativePath}`);
    const err = new Error(`无法写入系统文件: ${path.basename(relativePath)}`);
    (err as any).statusCode = 403;
    throw err;
  }

  const safePath = await validatePathAsync(relativePath);
  sandboxLogger.debug(`Writing file: ${safePath}`);
  await fs.mkdir(path.dirname(safePath), { recursive: true });
  return fs.writeFile(safePath, content, 'utf-8');
}

export async function appendFile(relativePath: string, content: string): Promise<void> {
  // Check system file protection first
  if (isSystemFile(relativePath)) {
    sandboxLogger.warn(`Blocked append to system file: ${relativePath}`);
    const err = new Error(`无法写入系统文件: ${path.basename(relativePath)}`);
    (err as any).statusCode = 403;
    throw err;
  }

  const safePath = await validatePathAsync(relativePath);
  sandboxLogger.debug(`Appending to file: ${safePath}`);
  await fs.mkdir(path.dirname(safePath), { recursive: true });
  return fs.appendFile(safePath, content, 'utf-8');
}

export async function deleteFile(relativePath: string): Promise<void> {
  // Check system file protection first
  if (isSystemFile(relativePath)) {
    sandboxLogger.warn(`Blocked delete of system file: ${relativePath}`);
    const err = new Error(`无法删除系统文件: ${path.basename(relativePath)}`);
    (err as any).statusCode = 403;
    throw err;
  }

  const safePath = await validatePathAsync(relativePath);
  sandboxLogger.debug(`Deleting file: ${safePath}`);
  return fs.unlink(safePath);
}

export async function listDir(relativePath: string): Promise<string[]> {
  const safePath = await validatePathAsync(relativePath);
  sandboxLogger.debug(`Listing directory: ${safePath}`);
  return fs.readdir(safePath);
}

export async function fileExists(relativePath: string): Promise<boolean> {
  try {
    const safePath = await validatePathAsync(relativePath);
    await fs.access(safePath);
    return true;
  } catch {
    return false;
  }
}

// ==================== Internal Operations (bypass system file protection) ====================
// These are for use by the sandbox manager and config service ONLY.
// They bypass the system file protection check but still enforce workspace boundaries.

/**
 * Write a file without system file protection checks.
 * INTERNAL USE ONLY — for sandbox manager and config service.
 */
export async function forceWriteFile(relativePath: string, content: string): Promise<void> {
  const safePath = await validatePathAsync(relativePath);
  sandboxLogger.debug(`Force writing file: ${safePath}`);
  await fs.mkdir(path.dirname(safePath), { recursive: true });
  return fs.writeFile(safePath, content, 'utf-8');
}

/**
 * Read a file without any extra checks beyond workspace boundary.
 * INTERNAL USE ONLY.
 */
export async function forceReadFile(relativePath: string): Promise<string> {
  const safePath = await validatePathAsync(relativePath);
  sandboxLogger.debug(`Force reading file: ${safePath}`);
  return fs.readFile(safePath, 'utf-8');
}
