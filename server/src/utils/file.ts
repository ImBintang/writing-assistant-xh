// server/src/utils/file.ts

import fs from 'fs/promises';
import path from 'path';
import { sandboxLogger } from './logger';

// Resolved at module load time
let workspaceRoot: string = '';

export function setWorkspaceRoot(root: string): void {
  workspaceRoot = path.resolve(root);
}

export function getWorkspaceRoot(): string {
  return workspaceRoot;
}

/**
 * Validate that a target path is within the workspace.
 * Resolves '..' segments via path.resolve, then normalizes
 * separators and appends trailing slash before prefix check
 * to prevent path traversal bypasses.
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
    const err = new Error(`Path "${targetPath}" is outside the workspace`);
    (err as any).statusCode = 403;
    throw err;
  }

  return resolved;
}

export async function readFile(relativePath: string): Promise<string> {
  const safePath = validatePath(relativePath);
  sandboxLogger.debug(`Reading file: ${safePath}`);
  return fs.readFile(safePath, 'utf-8');
}

export async function writeFile(relativePath: string, content: string): Promise<void> {
  const safePath = validatePath(relativePath);
  sandboxLogger.debug(`Writing file: ${safePath}`);
  await fs.mkdir(path.dirname(safePath), { recursive: true });
  return fs.writeFile(safePath, content, 'utf-8');
}

export async function appendFile(relativePath: string, content: string): Promise<void> {
  const safePath = validatePath(relativePath);
  sandboxLogger.debug(`Appending to file: ${safePath}`);
  await fs.mkdir(path.dirname(safePath), { recursive: true });
  return fs.appendFile(safePath, content, 'utf-8');
}

export async function deleteFile(relativePath: string): Promise<void> {
  const safePath = validatePath(relativePath);
  sandboxLogger.debug(`Deleting file: ${safePath}`);
  return fs.unlink(safePath);
}

export async function listDir(relativePath: string): Promise<string[]> {
  const safePath = validatePath(relativePath);
  sandboxLogger.debug(`Listing directory: ${safePath}`);
  return fs.readdir(safePath);
}

export async function fileExists(relativePath: string): Promise<boolean> {
  try {
    const safePath = validatePath(relativePath);
    await fs.access(safePath);
    return true;
  } catch {
    return false;
  }
}
