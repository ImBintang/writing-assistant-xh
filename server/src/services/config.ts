// server/src/services/config.ts
// Configuration management service for PRD-07.
// Handles loading/saving user config, model CRUD, function mapping,
// connection testing, and API key masking.

import path from 'path';
import dotenv from 'dotenv';
import { defaultConfig, defaultPresets, defaultFunctionMapping } from '../config/default';
import type { ModelPreset, SystemConfig } from '../config/default';
import { forceWriteFile, forceReadFile, fileExists } from '../utils/file';
import { invalidateModelCache } from '../agents/client';
import { setApiKeyCache, clearApiKeyFromCache, getApiKeyCacheSnapshot } from '../utils/apiKeys';
import { appLogger } from '../utils/logger';

// ==================== User Config Persistence ====================

export interface UserConfig {
  version?: string;
  models?: {
    default?: string;
    customPresets?: ModelPreset[];
  };
  context?: {
    maxInputTokens?: number;
    maxOutputTokens?: number;
    knowledgeContextBudget?: number;
  };
  functionMapping?: Record<string, string>;
  apiKeys?: Record<string, string>;
}

const USER_CONFIG_PATH = 'user-config.json';

/**
 * Load user configuration from workspace/user-config.json.
 */
export async function loadUserConfig(): Promise<UserConfig> {
  try {
    const exists = await fileExists(USER_CONFIG_PATH);
    if (exists) {
      const raw = await forceReadFile(USER_CONFIG_PATH);
      const config = JSON.parse(raw) as UserConfig;
      // Populate API key cache from user config (process.env still takes priority)
      if (config.apiKeys) {
        setApiKeyCache(config.apiKeys);
      }
      return config;
    }
  } catch (err) {
    appLogger.warn(`Failed to load user config: ${err}`);
  }
  return {};
}

/**
 * Save user configuration to workspace/user-config.json.
 * Uses forceWriteFile to bypass system file protection
 * (user-config.json is a system file that the config API is authorized to modify).
 */
export async function saveUserConfig(config: UserConfig): Promise<void> {
  // Merge with existing config to avoid losing keys we don't handle
  const existing = await loadUserConfig();
  const merged = { ...existing, ...config };

  await forceWriteFile(USER_CONFIG_PATH, JSON.stringify(merged, null, 2));
  appLogger.info('User config saved');

  // Update API key cache before invalidating clients so they read fresh keys
  if (merged.apiKeys) {
    setApiKeyCache(merged.apiKeys);
  }

  // Invalidate caches so next AI call picks up changes (incl. API key changes)
  invalidateModelCache();
}

/**
 * Get the fully merged configuration (defaults + user overrides).
 */
export async function getMergedConfig(): Promise<SystemConfig> {
  const userConfig = await loadUserConfig();

  return {
    version: defaultConfig.version,
    models: {
      default: userConfig.models?.default || defaultConfig.models.default,
      presets: [
        ...defaultPresets,
        ...(userConfig.models?.customPresets || []),
      ],
    },
    context: {
      maxInputTokens:
        userConfig.context?.maxInputTokens || defaultConfig.context.maxInputTokens,
      maxOutputTokens:
        userConfig.context?.maxOutputTokens || defaultConfig.context.maxOutputTokens,
      knowledgeContextBudget:
        userConfig.context?.knowledgeContextBudget ||
        defaultConfig.context.knowledgeContextBudget,
    },
  };
}

// ==================== Model CRUD ====================

/**
 * Get all available model presets (built-in + custom).
 */
export async function getAllModelPresets(): Promise<ModelPreset[]> {
  const config = await getMergedConfig();
  return config.models.presets;
}

/**
 * Add a custom model preset.
 */
export async function addCustomModel(preset: ModelPreset): Promise<ModelPreset> {
  const userConfig = await loadUserConfig();

  if (!userConfig.models) {
    userConfig.models = {};
  }
  if (!userConfig.models.customPresets) {
    userConfig.models.customPresets = [];
  }

  // Check if preset with same ID already exists
  const existing = userConfig.models.customPresets.find((p) => p.id === preset.id);
  if (existing) {
    const err = new Error(`模型预设 "${preset.id}" 已存在`);
    (err as any).statusCode = 409;
    throw err;
  }

  // Also check built-in presets
  const builtIn = defaultPresets.find((p) => p.id === preset.id);
  if (builtIn) {
    const err = new Error(`不能覆盖内置模型预设 "${preset.id}"`);
    (err as any).statusCode = 409;
    throw err;
  }

  userConfig.models.customPresets.push(preset);
  await saveUserConfig(userConfig);

  appLogger.info(`Custom model preset added: ${preset.id}`);
  return preset;
}

/**
 * Delete a custom model preset by ID.
 * Only custom presets can be deleted — built-in presets are protected.
 */
export async function deleteCustomModel(id: string): Promise<void> {
  // Reject deletion of built-in presets
  const builtIn = defaultPresets.find((p) => p.id === id);
  if (builtIn) {
    const err = new Error(`不能删除内置模型预设 "${id}"`);
    (err as any).statusCode = 403;
    throw err;
  }

  const userConfig = await loadUserConfig();
  const customPresets = userConfig.models?.customPresets || [];

  const index = customPresets.findIndex((p) => p.id === id);
  if (index === -1) {
    const err = new Error(`自定义模型预设 "${id}" 不存在`);
    (err as any).statusCode = 404;
    throw err;
  }

  customPresets.splice(index, 1);
  userConfig.models!.customPresets = customPresets;
  await saveUserConfig(userConfig);

  appLogger.info(`Custom model preset deleted: ${id}`);
}

// ==================== Function Mapping ====================

/**
 * Get the current function-to-model mapping (user overrides merged with defaults).
 */
export async function getFunctionMapping(): Promise<Record<string, string>> {
  const userConfig = await loadUserConfig();
  return {
    ...defaultFunctionMapping,
    ...(userConfig.functionMapping || {}),
  };
}

/**
 * Update the function-to-model mapping.
 * Validates that each target model preset exists.
 */
export async function updateFunctionMapping(
  mapping: Record<string, string>,
): Promise<Record<string, string>> {
  const allPresets = await getAllModelPresets();

  // Validate that all referenced presets exist
  for (const [func, presetId] of Object.entries(mapping)) {
    const preset = allPresets.find((p) => p.id === presetId);
    if (!preset) {
      const err = new Error(`模型预设 "${presetId}" 不存在（功能: ${func}）`);
      (err as any).statusCode = 400;
      throw err;
    }
  }

  const userConfig = await loadUserConfig();
  userConfig.functionMapping = {
    ...(userConfig.functionMapping || {}),
    ...mapping,
  };
  await saveUserConfig(userConfig);

  appLogger.info(`Function mapping updated: ${JSON.stringify(mapping)}`);
  return userConfig.functionMapping;
}

// ==================== Connection Testing ====================

/**
 * Test a model connection by sending a minimal ping message.
 */
export async function testModelConnection(
  presetId: string,
): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  const allPresets = await getAllModelPresets();
  const preset = allPresets.find((p) => p.id === presetId);

  if (!preset) {
    return { success: false, message: `模型预设 "${presetId}" 不存在` };
  }

  const startTime = Date.now();

  try {
    // Create a provider directly from the tested preset's configuration
    // (not via getProviderForMode, which would use the chat mapping's preset)
    const clientModule = await import('../agents/client.js');
    const { getProvider } = clientModule;
    const provider = getProvider(preset.provider, preset.baseUrl);

    // Use the tested preset's own modelId for the ping
    const result = await provider.chat({
      model: preset.modelId,
      maxTokens: 50,
      temperature: 0,
      system: 'You are a test assistant. Reply with only "OK".',
      messages: [
        {
          role: 'user',
          content: 'ping',
        },
      ],
    });

    const latencyMs = Date.now() - startTime;

    const textBlocks = result.content.filter((c: { type: string }) => c.type === 'text');
    const replyText = textBlocks.map((b: { type: string; text?: string }) => (b as unknown as { type: 'text'; text: string }).text).join('');

    return {
      success: true,
      message: `连接成功！模型响应: "${replyText.slice(0, 50)}"`,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);

    appLogger.warn(`Model connection test failed for ${presetId}: ${errorMsg}`);

    return {
      success: false,
      message: `连接失败: ${errorMsg}`,
      latencyMs,
    };
  }
}

// ==================== API Key Masking ====================

/**
 * Mask an API key for display:
 * Returns first 4 + "****" + last 4 characters.
 *
 * @param key - The API key to mask
 * @returns Masked key string (e.g., "sk-a****b1c2")
 */
export function maskApiKey(key: string): string {
  if (!key || key.length < 8) {
    return '****';
  }

  const first4 = key.slice(0, 4);
  const last4 = key.slice(-4);
  return `${first4}****${last4}`;
}

/**
 * Sanitize a config object for API response.
 * - Masks actual API key values
 * - Preserves apiKeyEnv names (they're just env var names)
 * - Removes any raw key values from custom presets
 */
export function sanitizeConfigForResponse(config: SystemConfig): SystemConfig {
  // Deep clone with sanitized presets
  const sanitized: SystemConfig = {
    ...config,
    models: {
      ...config.models,
      presets: config.models.presets.map((p) => ({
        ...p,
        // apiKeyEnv is just a name (e.g., "ANTHROPIC_API_KEY"), keep it
        // but if any preset had a raw apiKey field, mask it
        ...(p as any).apiKey ? { apiKey: maskApiKey((p as any).apiKey) } : {},
      })),
    },
  };

  return sanitized;
}

/**
 * Get API key status (whether configured) for each provider,
 * without revealing the actual key values.
 *
 * Returns source information so the frontend can distinguish:
 * - 'env': configured via .env (read-only, restart required to change)
 * - 'user-config': configured via UI (can be changed/removed in-app)
 * - 'none': not configured
 */
export function getApiKeyStatus(): Record<string, { configured: boolean; envVar: string; source: 'env' | 'user-config' | 'none' }> {
  const cacheSnapshot = getApiKeyCacheSnapshot();

  function resolve(envVar: string): { configured: boolean; source: 'env' | 'user-config' | 'none' } {
    if (process.env[envVar]) {
      return { configured: true, source: 'env' };
    }
    if (cacheSnapshot[envVar]) {
      return { configured: true, source: 'user-config' };
    }
    return { configured: false, source: 'none' };
  }

  return {
    claude: { ...resolve('ANTHROPIC_API_KEY'), envVar: 'ANTHROPIC_API_KEY' },
    openai: { ...resolve('OPENAI_API_KEY'), envVar: 'OPENAI_API_KEY' },
    ollama: { ...resolve('OLLAMA_API_KEY'), envVar: 'OLLAMA_API_KEY' },
  };
}

// ==================== API Key Management ====================

/** Map provider key to environment variable name. */
const PROVIDER_TO_ENV_VAR: Record<string, string> = {
  claude: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  ollama: 'OLLAMA_API_KEY',
};

/**
 * Set (or update) an API key for a given provider.
 * Key is persisted to user-config.json and cached in-memory.
 * Basic format validation is performed; no connectivity test.
 *
 * .env keys always take priority. Setting a key via this function
 * has no effect if the same key is also defined in .env.
 *
 * @param provider - Provider key: 'claude', 'openai', or 'ollama'
 * @param key - The API key value (plaintext)
 */
export async function setApiKey(provider: string, key: string): Promise<void> {
  const envVar = PROVIDER_TO_ENV_VAR[provider];
  if (!envVar) {
    const err = new Error(`未知的 provider: ${provider}`);
    (err as any).statusCode = 400;
    throw err;
  }

  // Basic format validation
  const trimmed = key.trim();
  if (!trimmed) {
    const err = new Error('API Key 不能为空');
    (err as any).statusCode = 400;
    throw err;
  }
  if (trimmed.length > 500) {
    const err = new Error('API Key 长度超出限制（最大 500 字符）');
    (err as any).statusCode = 400;
    throw err;
  }

  const userConfig = await loadUserConfig();
  if (!userConfig.apiKeys) {
    userConfig.apiKeys = {};
  }
  userConfig.apiKeys[envVar] = trimmed;

  await saveUserConfig(userConfig);
  appLogger.info(`API key set for provider: ${provider}`);
}

/**
 * Delete a user-configured API key for a given provider.
 * Only affects keys stored in user-config.json; .env keys are untouched.
 *
 * @param provider - Provider key: 'claude', 'openai', or 'ollama'
 */
export async function deleteApiKey(provider: string): Promise<void> {
  const envVar = PROVIDER_TO_ENV_VAR[provider];
  if (!envVar) {
    const err = new Error(`未知的 provider: ${provider}`);
    (err as any).statusCode = 400;
    throw err;
  }

  const userConfig = await loadUserConfig();
  if (userConfig.apiKeys) {
    delete userConfig.apiKeys[envVar];
  }

  // Remove from cache
  clearApiKeyFromCache(envVar);

  await saveUserConfig(userConfig);
  appLogger.info(`API key deleted for provider: ${provider}`);
}

// ==================== .env Reload ====================

/** Resolved absolute path to the .env file at monorepo root. */
const ENV_FILE_PATH = path.resolve(__dirname, '..', '..', '..', '.env');

/**
 * Reload environment variables from the .env file.
 *
 * By default dotenv does NOT override existing process.env values.
 * We use `override: true` so that edited entries in .env win over
 * the in-memory process.env that was set at server startup.
 *
 * After reloading, the API key cache is NOT touched — it holds
 * user-config.json values which are independent of .env.
 * The model cache is invalidated so the next AI call picks up
 * any changed credentials.
 *
 * @returns An object mapping each provider to its new status.
 */
export function reloadEnvVars(): Record<string, { configured: boolean; source: 'env' | 'user-config' | 'none' }> {
  const result = dotenv.config({ path: ENV_FILE_PATH, override: true });

  if (result.error) {
    appLogger.error(`Failed to reload .env: ${result.error.message}`);
    throw new Error(`无法重新加载 .env 文件: ${result.error.message}`);
  }

  const parsedCount = result.parsed ? Object.keys(result.parsed).length : 0;
  appLogger.info(`.env reloaded — ${parsedCount} vars parsed`);

  // Invalidate model cache so next AI call uses potentially-new credentials
  invalidateModelCache();

  // Return per-provider status snapshot
  const snapshot = getApiKeyCacheSnapshot();
  function resolve(envVar: string): { configured: boolean; source: 'env' | 'user-config' | 'none' } {
    if (process.env[envVar]) return { configured: true, source: 'env' };
    if (snapshot[envVar]) return { configured: true, source: 'user-config' };
    return { configured: false, source: 'none' };
  }

  return {
    claude: { ...resolve('ANTHROPIC_API_KEY'), envVar: 'ANTHROPIC_API_KEY' },
    openai: { ...resolve('OPENAI_API_KEY'), envVar: 'OPENAI_API_KEY' },
    ollama: { ...resolve('OLLAMA_API_KEY'), envVar: 'OLLAMA_API_KEY' },
  } as any;
}
