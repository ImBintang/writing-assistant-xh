// server/src/services/config.ts
// Configuration management service for PRD-07.
// Handles loading/saving user config, model CRUD, function mapping,
// connection testing, and API key masking.

import { defaultConfig, defaultPresets, defaultFunctionMapping } from '../config/default';
import type { ModelPreset, SystemConfig } from '../config/default';
import { forceWriteFile, forceReadFile, fileExists } from '../utils/file';
import { invalidateModelCache } from '../agents/client';
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
      return JSON.parse(raw) as UserConfig;
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

  // Invalidate caches so next AI call picks up changes
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
    // Use the multi-provider architecture to test
    const clientModule = await import('../agents/client.js');
    const { provider } = await clientModule.getProviderForMode('chat');

    // If the preset being tested is different from the current mapping for 'chat',
    // we need to test it directly
    // For now, test via the provider's chat with a minimal message
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
 */
export function getApiKeyStatus(): Record<string, { configured: boolean; envVar: string }> {
  return {
    claude: {
      configured: !!process.env.ANTHROPIC_API_KEY,
      envVar: 'ANTHROPIC_API_KEY',
    },
    openai: {
      configured: !!process.env.OPENAI_API_KEY,
      envVar: 'OPENAI_API_KEY',
    },
    ollama: {
      configured: !!process.env.OLLAMA_API_KEY,
      envVar: 'OLLAMA_API_KEY',
    },
  };
}
