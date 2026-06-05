// server/src/routes/api.ts

import { Router, Request, Response } from 'express';
import { getSandbox } from '../sandbox';
import { defaultConfig, defaultPresets, defaultFunctionMapping } from '../config/default';
import { appLogger } from '../utils/logger';
import { fileExists, readFile, writeFile } from '../utils/file';

const router = Router();

// =================== Health & System ===================

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/system/info', (_req: Request, res: Response) => {
  res.json({
    name: 'writing-assistant',
    version: '0.1.0',
    nodeVersion: process.version,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  });
});

// =================== Workspace ===================

router.get('/workspace/status', async (_req: Request, res: Response) => {
  const sandbox = getSandbox();
  const status = await sandbox.getStatus();
  res.json(status);
});

router.post('/workspace/init', async (_req: Request, res: Response) => {
  const sandbox = getSandbox();
  await sandbox.initialize();
  const status = await sandbox.getStatus();
  res.json({ message: 'Workspace re-initialized', ...status });
});

// =================== Config ===================

router.get('/config', async (_req: Request, res: Response) => {
  let userConfig = {};

  try {
    const exists = await fileExists('user-config.json');
    if (exists) {
      const raw = await readFile('user-config.json');
      userConfig = JSON.parse(raw);
    }
  } catch (err) {
    appLogger.warn(`Failed to load user config: ${err}`);
  }

  // Merge: user config overrides defaults
  const merged = {
    ...defaultConfig,
    ...userConfig,
    models: {
      ...defaultConfig.models,
      ...((userConfig as any).models || {}),
    },
  };

  res.json(merged);
});

router.put('/config', async (req: Request, res: Response) => {
  const newConfig = req.body;

  // Deep merge with existing user config
  let existingConfig = {};
  try {
    const exists = await fileExists('user-config.json');
    if (exists) {
      const raw = await readFile('user-config.json');
      existingConfig = JSON.parse(raw);
    }
  } catch {
    // Start fresh if corrupt
  }

  const merged = { ...existingConfig, ...newConfig };
  await writeFile('user-config.json', JSON.stringify(merged, null, 2));

  appLogger.info('User config updated');
  res.json({ message: 'Config updated', config: merged });
});

router.get('/config/presets', (_req: Request, res: Response) => {
  res.json({
    presets: defaultPresets,
    functionMapping: defaultFunctionMapping,
  });
});

export default router;
