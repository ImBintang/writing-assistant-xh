// server/src/services/splitter.ts

import { spawn } from 'child_process';
import path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('splitter');

// Resolve the scripts directory relative to this service file:
// server/src/services/splitter.ts -> monorepo_root/scripts/
const SCRIPTS_DIR = path.resolve(__dirname, '..', '..', '..', 'scripts');

// Determine Python binary
const PYTHON_BINARY = process.platform === 'win32' ? 'python' : 'python3';

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
