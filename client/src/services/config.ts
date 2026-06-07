// client/src/services/config.ts
// System config API service for PRD-07
// Handles model configuration, function mapping, connection testing, and context usage.

import { api } from './api';

// ==================== Types ====================

export interface ModelPreset {
  id: string;
  name: string;
  provider: 'claude' | 'openai' | 'ollama';
  modelId: string;
  apiKeyEnv: string;
  baseUrl?: string;
  description?: string;
  /** When false, disables extended thinking for this model. */
  thinkingEnabled?: boolean;
}

export interface ContextConfig {
  maxInputTokens: number;
  maxOutputTokens: number;
  knowledgeContextBudget: number;
}

export interface SystemConfig {
  version: string;
  models: {
    default: string;
    presets: ModelPreset[];
  };
  context: ContextConfig;
  functionMapping?: Record<string, string>;
  apiKeyStatus?: Record<string, { configured: boolean; envVar: string; source: 'env' | 'user-config' | 'none' }>;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

export interface ContextUsageRecord {
  function: string;
  inputTokens: number;
  outputTokens: number;
  timestamp: string;
}

export interface ContextUsage {
  recentCalls: ContextUsageRecord[];
  summary: {
    totalCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    averageInputTokens: number;
    averageOutputTokens: number;
  };
  byFunction: Record<
    string,
    {
      calls: number;
      totalInputTokens: number;
      totalOutputTokens: number;
    }
  >;
}

export interface ApiKeyStatus {
  [provider: string]: {
    configured: boolean;
    envVar: string;
    source: 'env' | 'user-config' | 'none';
  };
}

// ==================== API Functions ====================

export async function fetchConfig(): Promise<SystemConfig> {
  const response = await api.get<SystemConfig>('/api/v1/config');
  return response.data;
}

export async function updateConfig(
  data: Partial<{
    models?: { default?: string };
    context?: Partial<ContextConfig>;
    functionMapping?: Record<string, string>;
  }>,
): Promise<{ message: string; config: SystemConfig }> {
  const response = await api.put('/api/v1/config', data);
  return response.data;
}

export async function fetchModels(): Promise<ModelPreset[]> {
  const response = await api.get<ModelPreset[]>('/api/v1/config/models');
  return response.data;
}

export async function addCustomModel(
  data: Omit<ModelPreset, 'id'> & { id: string },
): Promise<ModelPreset> {
  const response = await api.post<ModelPreset>('/api/v1/config/models', data);
  return response.data;
}

export async function deleteCustomModel(id: string): Promise<void> {
  await api.delete(`/api/v1/config/models/${encodeURIComponent(id)}`);
}

export async function fetchFunctionMapping(): Promise<Record<string, string>> {
  const response = await api.get<Record<string, string>>('/api/v1/config/function-mapping');
  return response.data;
}

export async function updateFunctionMapping(
  mapping: Record<string, string>,
): Promise<{ message: string; mapping: Record<string, string> }> {
  const response = await api.put('/api/v1/config/function-mapping', mapping);
  return response.data;
}

export async function testConnection(modelId: string): Promise<TestConnectionResult> {
  const response = await api.post<TestConnectionResult>(
    `/api/v1/config/models/${encodeURIComponent(modelId)}/test`,
  );
  return response.data;
}

export async function fetchContextUsage(): Promise<ContextUsage> {
  const response = await api.get<ContextUsage>('/api/v1/config/system/context-usage');
  return response.data;
}

export async function validatePath(path: string): Promise<{ valid: boolean; resolvedPath?: string; message: string }> {
  const response = await api.post('/api/v1/config/system/validate-path', { path });
  return response.data;
}

export async function updateApiKey(
  provider: string,
  key: string,
): Promise<{ message: string; apiKeyStatus: ApiKeyStatus }> {
  const response = await api.put('/api/v1/config/api-keys', { provider, key });
  return response.data;
}

export async function deleteApiKey(
  provider: string,
): Promise<{ message: string; apiKeyStatus: ApiKeyStatus }> {
  const response = await api.delete(`/api/v1/config/api-keys/${encodeURIComponent(provider)}`);
  return response.data;
}

export async function reloadEnv(): Promise<{ message: string; apiKeyStatus: ApiKeyStatus }> {
  const response = await api.post<{ message: string; apiKeyStatus: ApiKeyStatus }>(
    '/api/v1/config/system/reload-env',
  );
  return response.data;
}
