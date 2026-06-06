// server/src/routes/config.ts
// Configuration management routes for PRD-07.
// Mounted at /api/v1/config

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getMergedConfig,
  getAllModelPresets,
  addCustomModel,
  deleteCustomModel,
  getFunctionMapping,
  updateFunctionMapping,
  testModelConnection,
  sanitizeConfigForResponse,
  getApiKeyStatus,
  loadUserConfig,
  saveUserConfig,
} from '../services/config';
import { appLogger } from '../utils/logger';
import { buildContextUsageReport } from '../utils/context';
import { validatePath } from '../utils/file';
import type { ModelPreset } from '../config/default';

const router = Router();

// ==================== Zod Schemas ====================

const modelPresetSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  provider: z.enum(['claude', 'openai', 'ollama']),
  modelId: z.string().min(1).max(200),
  apiKeyEnv: z.string().min(1).max(100),
  baseUrl: z.string().optional(),
  description: z.string().max(500).optional(),
});

const functionMappingSchema = z.record(z.string(), z.string());

const configUpdateSchema = z.object({
  models: z
    .object({
      default: z.string().optional(),
    })
    .optional(),
  context: z
    .object({
      maxInputTokens: z.number().min(1000).max(1000000).optional(),
      maxOutputTokens: z.number().min(100).max(100000).optional(),
      knowledgeContextBudget: z.number().min(1000).max(500000).optional(),
    })
    .optional(),
  functionMapping: z.record(z.string(), z.string()).optional(),
});

// ==================== Config CRUD ====================

/**
 * GET / — Get full system config (with API keys masked)
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const config = await getMergedConfig();
    const sanitized = sanitizeConfigForResponse(config);
    const functionMapping = await getFunctionMapping();
    const apiKeyStatus = getApiKeyStatus();

    res.json({
      ...sanitized,
      functionMapping,
      apiKeyStatus,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    appLogger.error(`GET /config failed: ${message}`);
    res.status(500).json({ error: { message, status: 500 } });
  }
});

/**
 * PUT / — Update system config
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const parsed = configUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          message: '配置格式无效',
          details: parsed.error.issues,
          status: 400,
        },
      });
      return;
    }

    const userConfig = await loadUserConfig();
    const update = parsed.data;

    // Merge updates into user config
    if (update.models) {
      userConfig.models = { ...(userConfig.models || {}), ...update.models };
    }
    if (update.context) {
      userConfig.context = { ...(userConfig.context || {}), ...update.context };
    }
    if (update.functionMapping) {
      // Validate mapping before saving
      await updateFunctionMapping(update.functionMapping);
      // updateFunctionMapping already saved — remove from payload
      delete update.functionMapping;
    }

    await saveUserConfig(userConfig);

    const config = await getMergedConfig();
    const sanitized = sanitizeConfigForResponse(config);

    res.json({ message: '配置已更新', config: sanitized });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const statusCode = (err as any).statusCode || 500;
    appLogger.error(`PUT /config failed: ${message}`);
    res.status(statusCode).json({ error: { message, status: statusCode } });
  }
});

// ==================== Model Management ====================

/**
 * GET /models — List all model presets
 */
router.get('/models', async (_req: Request, res: Response) => {
  try {
    const presets = await getAllModelPresets();
    res.json(presets);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: { message, status: 500 } });
  }
});

/**
 * POST /models — Add a custom model preset
 */
router.post('/models', async (req: Request, res: Response) => {
  try {
    const parsed = modelPresetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          message: '模型配置格式无效',
          details: parsed.error.issues,
          status: 400,
        },
      });
      return;
    }

    const preset = await addCustomModel({
      ...parsed.data,
      description: parsed.data.description || '',
    } as ModelPreset);
    res.status(201).json(preset);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const statusCode = (err as any).statusCode || 500;
    res.status(statusCode).json({ error: { message, status: statusCode } });
  }
});

/**
 * DELETE /models/:id — Delete a custom model preset
 */
router.delete('/models/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await deleteCustomModel(id);
    res.json({ message: `模型预设 "${id}" 已删除` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const statusCode = (err as any).statusCode || 500;
    res.status(statusCode).json({ error: { message, status: statusCode } });
  }
});

/**
 * POST /models/:id/test — Test model connection
 */
router.post('/models/:id/test', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const result = await testModelConnection(id);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const statusCode = (err as any).statusCode || 500;
    res.status(statusCode).json({ error: { message, status: statusCode } });
  }
});

// ==================== Function Mapping ====================

/**
 * GET /function-mapping — Get current function-to-model mapping
 */
router.get('/function-mapping', async (_req: Request, res: Response) => {
  try {
    const mapping = await getFunctionMapping();
    res.json(mapping);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: { message, status: 500 } });
  }
});

/**
 * PUT /function-mapping — Update function-to-model mapping
 */
router.put('/function-mapping', async (req: Request, res: Response) => {
  try {
    const parsed = functionMappingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          message: '映射格式无效',
          details: parsed.error.issues,
          status: 400,
        },
      });
      return;
    }

    const mapping = await updateFunctionMapping(parsed.data);
    res.json({ message: '功能映射已更新', mapping });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const statusCode = (err as any).statusCode || 500;
    res.status(statusCode).json({ error: { message, status: statusCode } });
  }
});

// ==================== System Endpoints ====================

/**
 * GET /system/context-usage — Get current context usage statistics
 */
router.get('/system/context-usage', (_req: Request, res: Response) => {
  try {
    const report = buildContextUsageReport();
    res.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: { message, status: 500 } });
  }
});

/**
 * POST /system/validate-path — Debug endpoint: validate a path against workspace
 */
router.post('/system/validate-path', (req: Request, res: Response) => {
  try {
    const { path: targetPath } = req.body;
    if (!targetPath || typeof targetPath !== 'string') {
      res.status(400).json({ error: { message: '请提供 path 参数', status: 400 } });
      return;
    }

    // Synchronous validation (no symlink resolution — just path traversal check)
    const safePath = validatePath(targetPath);
    res.json({
      valid: true,
      resolvedPath: safePath,
      message: '路径安全',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const statusCode = (err as any).statusCode || 500;
    res.status(statusCode).json({
      valid: false,
      message,
      error: { message, status: statusCode },
    });
  }
});

export default router;
