// server/src/sandbox/index.ts

import path from 'path';
import fs from 'fs/promises';
import {
  setWorkspaceRoot,
  getWorkspaceRoot,
  readFile,
  writeFile,
  appendFile,
  deleteFile,
  listDir,
  fileExists,
  validatePath,
} from '../utils/file';
import { WORKSPACE_VERSION } from '../config/default';
import { sandboxLogger } from '../utils/logger';

const WORKSPACE_DIRS = [
  'originals',
  'chapters',
  'knowledge/characters',
  'knowledge/techniques',
  'knowledge/locations',
  'knowledge/worldbuilding',
  'knowledge/weapons',
  'knowledge/alchemy',
  'knowledge/plot',
  'settings',
  'drafts',
  'logs',
];

export class SandboxManager {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    setWorkspaceRoot(this.workspaceRoot);
  }

  async initialize(): Promise<void> {
    sandboxLogger.info(`Initializing workspace at: ${this.workspaceRoot}`);

    // Create workspace root if needed
    await fs.mkdir(this.workspaceRoot, { recursive: true });

    // Create all subdirectories
    for (const dir of WORKSPACE_DIRS) {
      const fullPath = path.join(this.workspaceRoot, dir);
      await fs.mkdir(fullPath, { recursive: true });
      sandboxLogger.debug(`Created directory: ${dir}`);
    }

    // Handle .workspace.lock version check
    const lockPath = path.join(this.workspaceRoot, '.workspace.lock');
    try {
      const existingLock = await fs.readFile(lockPath, 'utf-8');
      const lockData = JSON.parse(existingLock) as { version: string; created: string };

      if (lockData.version !== WORKSPACE_VERSION) {
        sandboxLogger.warn(
          `Workspace version mismatch: lock=${lockData.version}, current=${WORKSPACE_VERSION}`,
        );
        // For now, just log. Future PRDs may add migration logic.
      } else {
        sandboxLogger.info(
          `Workspace version ${WORKSPACE_VERSION} matches, created ${lockData.created}`,
        );
      }
    } catch {
      // Lock file does not exist or is corrupt -- create it
      const lockData = {
        version: WORKSPACE_VERSION,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };
      await fs.writeFile(lockPath, JSON.stringify(lockData, null, 2), 'utf-8');
      sandboxLogger.info(`Created workspace lock file (version ${WORKSPACE_VERSION})`);
    }
  }

  async getStatus(): Promise<{
    root: string;
    version: string;
    directories: Record<string, { exists: boolean; fileCount: number }>;
  }> {
    const status: Record<string, { exists: boolean; fileCount: number }> = {};

    for (const dir of WORKSPACE_DIRS) {
      const fullPath = path.join(this.workspaceRoot, dir);
      try {
        const files = await fs.readdir(fullPath);
        status[dir] = { exists: true, fileCount: files.length };
      } catch {
        status[dir] = { exists: false, fileCount: 0 };
      }
    }

    return {
      root: this.workspaceRoot,
      version: WORKSPACE_VERSION,
      directories: status,
    };
  }

  // Delegate file operations
  async readFile(relativePath: string): Promise<string> {
    return readFile(relativePath);
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    return writeFile(relativePath, content);
  }

  async appendFile(relativePath: string, content: string): Promise<void> {
    return appendFile(relativePath, content);
  }

  async deleteFile(relativePath: string): Promise<void> {
    return deleteFile(relativePath);
  }

  async listDir(relativePath: string): Promise<string[]> {
    return listDir(relativePath);
  }

  async fileExists(relativePath: string): Promise<boolean> {
    return fileExists(relativePath);
  }

  validatePath(targetPath: string): string {
    return validatePath(targetPath);
  }

  getRoot(): string {
    return getWorkspaceRoot();
  }
}

// Singleton instance
let sandboxInstance: SandboxManager | null = null;

export function getSandbox(): SandboxManager {
  if (!sandboxInstance) {
    throw new Error('Sandbox not initialized. Call createSandbox() first.');
  }
  return sandboxInstance;
}

export async function createSandbox(workspacePath?: string): Promise<SandboxManager> {
  const root = workspacePath || path.resolve(process.cwd(), 'workspace');
  sandboxInstance = new SandboxManager(root);
  await sandboxInstance.initialize();
  return sandboxInstance;
}
