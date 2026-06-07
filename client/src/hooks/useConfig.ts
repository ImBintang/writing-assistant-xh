// client/src/hooks/useConfig.ts
// Zustand store for system config page (PRD-07)
// Manages model presets, function mapping, context config, and API key status.

import { create } from 'zustand';
import type { ModelPreset, SystemConfig, ContextUsage, TestConnectionResult } from '../services/config';
import {
  fetchConfig,
  updateConfig,
  fetchModels,
  addCustomModel as apiAddCustomModel,
  deleteCustomModel as apiDeleteCustomModel,
  fetchFunctionMapping,
  updateFunctionMapping as apiUpdateFunctionMapping,
  testConnection as apiTestConnection,
  fetchContextUsage,
  updateApiKey,
  deleteApiKey,
  reloadEnv,
} from '../services/config';

// ==================== Human-readable labels ====================

export const FUNCTION_LABELS: Record<string, string> = {
  extract: '知识提取',
  write: 'AI 撰写',
  polish: '文本润色',
  brainstorm: '头脑风暴',
  chat: '普通对话',
  skill_generate: 'Skill 生成',
};

export const FUNCTION_OPTIONS = Object.entries(FUNCTION_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const PROVIDER_LABELS: Record<string, string> = {
  claude: 'Claude (Anthropic)',
  openai: 'OpenAI',
  ollama: 'Ollama (本地)',
};

// ==================== Store ====================

interface ConfigState {
  // Data
  config: SystemConfig | null;
  models: ModelPreset[];
  functionMapping: Record<string, string>;
  contextUsage: ContextUsage | null;

  // UI state
  loading: boolean;
  saving: boolean;
  testingModelId: string | null;
  testResult: TestConnectionResult | null;
  showAddModelForm: boolean;
  error: string | null;
  successMessage: string | null;

  // API key UI state
  editingProvider: string | null;
  apiKeyInput: string;
  showApiKeyInput: boolean;

  // Actions
  loadConfig: () => Promise<void>;
  saveConfig: (data: Parameters<typeof updateConfig>[0]) => Promise<void>;
  loadModels: () => Promise<void>;
  addModel: (data: Omit<ModelPreset, 'id'> & { id: string }) => Promise<void>;
  deleteModel: (id: string) => Promise<void>;
  loadFunctionMapping: () => Promise<void>;
  saveFunctionMapping: (mapping: Record<string, string>) => Promise<void>;
  testModelConnection: (modelId: string) => Promise<void>;
  loadContextUsage: () => Promise<void>;
  setShowAddModelForm: (show: boolean) => void;
  clearMessages: () => void;

  // API key actions
  setEditingProvider: (provider: string | null) => void;
  setApiKeyInput: (value: string) => void;
  toggleShowApiKey: () => void;
  saveApiKey: (provider: string, key: string) => Promise<void>;
  removeApiKey: (provider: string) => Promise<void>;
  reloadEnvVars: () => Promise<void>;
}

export const useConfig = create<ConfigState>((set, get) => ({
  config: null,
  models: [],
  functionMapping: {},
  contextUsage: null,

  loading: false,
  saving: false,
  testingModelId: null,
  testResult: null,
  showAddModelForm: false,
  error: null,
  successMessage: null,

  editingProvider: null,
  apiKeyInput: '',
  showApiKeyInput: false,

  loadConfig: async () => {
    set({ loading: true, error: null });
    try {
      const config = await fetchConfig();
      set({
        config,
        models: config.models.presets,
        functionMapping: config.functionMapping || {},
        loading: false,
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : '加载配置失败',
      });
    }
  },

  saveConfig: async (data) => {
    set({ saving: true, error: null, successMessage: null });
    try {
      await updateConfig(data);
      // Reload config to get merged result
      await get().loadConfig();
      set({ saving: false, successMessage: '配置已保存' });
      // Auto-clear success message after 3 seconds
      setTimeout(() => set({ successMessage: null }), 3000);
    } catch (err) {
      set({
        saving: false,
        error: err instanceof Error ? err.message : '保存配置失败',
      });
    }
  },

  loadModels: async () => {
    try {
      const models = await fetchModels();
      set({ models });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '加载模型列表失败' });
    }
  },

  addModel: async (data) => {
    set({ saving: true, error: null });
    try {
      await apiAddCustomModel(data);
      await get().loadModels();
      set({ saving: false, showAddModelForm: false, successMessage: `模型 "${data.name}" 已添加` });
      setTimeout(() => set({ successMessage: null }), 3000);
    } catch (err) {
      set({
        saving: false,
        error: err instanceof Error ? err.message : '添加模型失败',
      });
    }
  },

  deleteModel: async (id) => {
    set({ saving: true, error: null });
    try {
      await apiDeleteCustomModel(id);
      await get().loadModels();
      set({ saving: false, successMessage: '模型已删除' });
      setTimeout(() => set({ successMessage: null }), 3000);
    } catch (err) {
      set({
        saving: false,
        error: err instanceof Error ? err.message : '删除模型失败',
      });
    }
  },

  loadFunctionMapping: async () => {
    try {
      const mapping = await fetchFunctionMapping();
      set({ functionMapping: mapping });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '加载功能映射失败' });
    }
  },

  saveFunctionMapping: async (mapping) => {
    set({ saving: true, error: null, successMessage: null });
    try {
      await apiUpdateFunctionMapping(mapping);
      set({
        saving: false,
        functionMapping: mapping,
        successMessage: '功能映射已更新',
      });
      setTimeout(() => set({ successMessage: null }), 3000);
    } catch (err) {
      set({
        saving: false,
        error: err instanceof Error ? err.message : '更新功能映射失败',
      });
    }
  },

  testModelConnection: async (modelId) => {
    set({ testingModelId: modelId, testResult: null, error: null });
    try {
      const result = await apiTestConnection(modelId);
      set({ testingModelId: null, testResult: result });
    } catch (err) {
      set({
        testingModelId: null,
        error: err instanceof Error ? err.message : '测试连接失败',
      });
    }
  },

  loadContextUsage: async () => {
    try {
      const usage = await fetchContextUsage();
      set({ contextUsage: usage });
    } catch (err) {
      // Silently fail — context usage is non-critical
      console.error('Failed to load context usage:', err);
    }
  },

  setShowAddModelForm: (show) => set({ showAddModelForm: show }),

  clearMessages: () => set({ error: null, successMessage: null, testResult: null }),

  // ==================== API Key Actions ====================

  setEditingProvider: (provider) => set({ editingProvider: provider, apiKeyInput: '', error: null }),

  setApiKeyInput: (value) => set({ apiKeyInput: value }),

  toggleShowApiKey: () => set((s) => ({ showApiKeyInput: !s.showApiKeyInput })),

  saveApiKey: async (provider, key) => {
    set({ saving: true, error: null, successMessage: null });
    try {
      const result = await updateApiKey(provider, key);
      set((s) => ({
        saving: false,
        editingProvider: null,
        apiKeyInput: '',
        showApiKeyInput: false,
        successMessage: result.message,
        config: s.config ? { ...s.config, apiKeyStatus: result.apiKeyStatus } : s.config,
      }));
      setTimeout(() => set({ successMessage: null }), 3000);
    } catch (err) {
      set({ saving: false, error: err instanceof Error ? err.message : '保存 API Key 失败' });
    }
  },

  removeApiKey: async (provider) => {
    set({ saving: true, error: null, successMessage: null });
    try {
      const result = await deleteApiKey(provider);
      set((s) => ({
        saving: false,
        successMessage: result.message,
        config: s.config ? { ...s.config, apiKeyStatus: result.apiKeyStatus } : s.config,
      }));
      setTimeout(() => set({ successMessage: null }), 3000);
    } catch (err) {
      set({ saving: false, error: err instanceof Error ? err.message : '删除 API Key 失败' });
    }
  },

  reloadEnvVars: async () => {
    set({ saving: true, error: null, successMessage: null });
    try {
      const result = await reloadEnv();
      set((s) => ({
        saving: false,
        successMessage: result.message,
        config: s.config ? { ...s.config, apiKeyStatus: result.apiKeyStatus } : s.config,
      }));
      setTimeout(() => set({ successMessage: null }), 3000);
    } catch (err) {
      set({ saving: false, error: err instanceof Error ? err.message : '刷新环境变量失败' });
    }
  },
}));
