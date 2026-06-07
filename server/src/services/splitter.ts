// server/src/services/splitter.ts

import { spawn, execSync } from 'child_process';
import path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('splitter');

// Resolve the scripts directory relative to this service file:
// server/src/services/splitter.ts -> monorepo_root/scripts/
const SCRIPTS_DIR = path.resolve(__dirname, '..', '..', '..', 'scripts');

/**
 * Detect a working Python binary.
 *
 * On Windows, the Microsoft Store app execution aliases (python.exe, python3.exe)
 * are stubs that fail with exit code 9009 when no Store-managed Python is
 * actually installed.  We skip those stubs and prefer a real installation.
 *
 * An explicit PYTHON_BINARY env var always takes precedence.
 */
function detectPythonBinary(): string {
  // 1. Explicit override
  if (process.env.PYTHON_BINARY) {
    logger.debug(`Using PYTHON_BINARY from env: ${process.env.PYTHON_BINARY}`);
    return process.env.PYTHON_BINARY;
  }

  if (process.platform !== 'win32') {
    return 'python3';
  }

  // 2. Windows: scan PATH for a real Python, skipping WindowsApps stubs
  try {
    const raw = execSync('where python 2>nul', { encoding: 'utf-8' });
    const paths = raw
      .split(/\r?\n/)
      .map((p: string) => p.trim())
      .filter((p: string) => p && !p.includes('WindowsApps'));

    if (paths.length > 0) {
      logger.debug(`Detected Python: ${paths[0]}`);
      return paths[0];
    }
  } catch {
    // 'where' returned nothing or failed — fall through to default
  }

  // 3. Last resort
  return 'python';
}

const PYTHON_BINARY = detectPythonBinary();

const SPLIT_TIMEOUT_MS = 60_000;  // 60 seconds for large files
const VALIDATE_TIMEOUT_MS = 30_000;

interface PythonResult {
  success: boolean;
  meta?: any;
  error?: string;
}

/**
 * Run a Python script with JSON-over-stdin/stdout protocol.
 *
 * @param scriptName  Name of the Python script file (e.g. "text_splitter.py")
 * @param input       Object to serialize as JSON and send to stdin
 * @param timeoutMs   Process timeout in milliseconds
 * @returns           Parsed JSON result from stdout
 */
function runPython(
  scriptName: string,
  input: Record<string, unknown>,
  timeoutMs: number = SPLIT_TIMEOUT_MS,
): Promise<PythonResult> {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);

  logger.debug(`Spawning: ${PYTHON_BINARY} ${scriptPath}`);

  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BINARY, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(
        new Error(`Python script "${scriptName}" timed out after ${timeoutMs}ms`),
      );
    }, timeoutMs);

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString('utf-8');
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString('utf-8');
    });

    proc.on('close', (code: number | null) => {
      clearTimeout(timer);

      if (stderr) {
        logger.debug(`Python stderr:\n${stderr}`);
      }

      if (code !== 0) {
        reject(
          new Error(
            `Python script "${scriptName}" exited with code ${code}: ${stderr.slice(0, 500)}`,
          ),
        );
        return;
      }

      try {
        const result = JSON.parse(stdout.trim()) as PythonResult;
        resolve(result);
      } catch {
        reject(
          new Error(
            `Failed to parse Python output from "${scriptName}": ${stdout.slice(0, 300)}`,
          ),
        );
      }
    });

    proc.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(
        new Error(`Failed to spawn Python: ${err.message}. Is Python installed?`),
      );
    });

    // Send input JSON to stdin
    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();
  });
}

/**
 * Split a text file into chapters using text_splitter.py.
 */
export async function splitChapters(
  filePath: string,
  outputDir: string,
  sourceName: string,
): Promise<any> {
  logger.info(`Starting chapter split for: ${sourceName}`);

  const result = await runPython('text_splitter.py', {
    filePath,
    outputDir,
    sourceName,
  });

  if (!result.success) {
    throw new Error(`Chapter splitting failed: ${result.error}`);
  }

  const meta = result.meta!;
  logger.info(`Split complete: ${meta.totalChapters} chapters found`);
  return meta;
}

/**
 * Validate chapter splits using split_validator.py.
 */
export async function validateChapters(metaPath: string): Promise<any> {
  logger.info('Starting anomaly detection');

  const result = await runPython(
    'split_validator.py',
    { metaPath },
    VALIDATE_TIMEOUT_MS,
  );

  if (!result.success) {
    throw new Error(`Anomaly detection failed: ${result.error}`);
  }

  const meta = result.meta!;
  logger.info(`Validation complete: ${meta.anomalies?.length ?? 0} anomalies found`);
  return meta;
}
