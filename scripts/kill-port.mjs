#!/usr/bin/env node

/**
 * kill-port.mjs — Cross-platform port cleanup with multi-layer fallback
 *
 * Usage: node scripts/kill-port.mjs 3000 5173
 * Kills any process occupying the specified ports.
 * Works on Windows (cmd / bash / PowerShell), macOS, and Linux.
 */

import { execSync } from 'node:child_process';
import { platform } from 'node:os';

const ports = process.argv.slice(2).map(Number).filter(Boolean);

if (ports.length === 0) {
  console.log('Usage: node kill-port.mjs <port1> [port2] ...');
  process.exit(0);
}

const os = platform();
const VERIFY_DELAY_MS = 800;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Run a command and return stdout as string; returns "" on any failure. */
function run(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 10_000,
      ...opts,
    }).trim();
  } catch {
    return '';
  }
}

/** Get all PIDs listening on `port`. Returns empty array if none. */
function getListeningPids(port) {
  const pids = new Set();

  if (os === 'win32') {
    // Strategy 1: PowerShell Get-NetTCPConnection (most reliable, works in any shell)
    const psOut = run(
      `powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique"`,
    );
    for (const line of psOut.split(/\r?\n/)) {
      const pid = line.trim();
      if (/^\d+$/.test(pid)) pids.add(pid);
    }

    // Strategy 2: netstat fallback (works in cmd.exe context)
    if (pids.size === 0) {
      const netstat = run('netstat -ano');
      const re = new RegExp(`:${port}\\s+\\S+\\s+\\S+\\s+LISTENING\\s+(\\d+)`, 'i');
      for (const line of netstat.split(/\r?\n/)) {
        const m = line.match(re);
        if (m) pids.add(m[1]);
      }
    }

    // Strategy 3: netstat via cmd.exe (bypasses bash environment issues)
    if (pids.size === 0) {
      const cmdOut = run(
        `cmd.exe /c "netstat -ano | findstr :${port} | findstr LISTENING"`,
      );
      const pidRe = /(\d+)\s*$/gm;
      let m;
      while ((m = pidRe.exec(cmdOut)) !== null) {
        pids.add(m[1]);
      }
    }
  } else {
    // macOS / Linux
    const lsofOut = run(`lsof -ti:${port}`);
    for (const pid of lsofOut.split(/\n/)) {
      const p = pid.trim();
      if (/^\d+$/.test(p)) pids.add(p);
    }
  }

  return [...pids];
}

/** Kill a PID — tries multiple strategies. Returns true if successful. */
function killPid(pid) {
  if (os === 'win32') {
    // Strategy 1: PowerShell Stop-Process (works everywhere)
    const r1 = run(
      `powershell.exe -NoProfile -Command "Stop-Process -Id ${pid} -Force -ErrorAction Stop; Write-Host 'ok'"`,
    );
    if (r1.includes('ok')) return true;

    // Strategy 2: taskkill via cmd.exe
    const r2 = run(`cmd.exe /c "taskkill /F /PID ${pid}"`);
    if (r2.includes('SUCCESS') || r2.includes('成功')) return true;

    // Strategy 3: tskill (last resort, no admin needed)
    const r3 = run(`tskill ${pid}`);
    return true; // tskill is silent even on success, assume ok
  } else {
    const r1 = run(`kill -9 ${pid}`);
    const stillThere = run(`ps -p ${pid} -o pid=`);
    return stillThere === '';
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

let anyKilled = false;

for (const port of ports) {
  const pids = getListeningPids(port);

  if (pids.length === 0) {
    console.log(`[--] Port ${port} is free`);
    continue;
  }

  for (const pid of pids) {
    const ok = killPid(pid);
    if (ok) {
      console.log(`[ok] Killed PID ${pid} (port ${port})`);
      anyKilled = true;
    } else {
      console.error(`[!!] Failed to kill PID ${pid} (port ${port})`);
    }
  }
}

// Wait for OS to release ports
if (anyKilled) {
  await new Promise((r) => setTimeout(r, VERIFY_DELAY_MS));

  // Verify — double-check ports are actually free
  let allClean = true;
  for (const port of ports) {
    const remaining = getListeningPids(port);
    if (remaining.length > 0) {
      console.error(
        `[!!] Port ${port} still occupied by PID(s): ${remaining.join(', ')}`,
      );
      allClean = false;
    }
  }

  if (allClean) {
    console.log('[OK] All ports confirmed free');
  } else {
    process.exitCode = 1;
  }
}

// Force exit — don't let dangling handles keep the process alive
setTimeout(() => process.exit(), 200).unref();
