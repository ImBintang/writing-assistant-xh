// server/src/config/default.ts

export interface ModelPreset {
  id: string;
  name: string;
  provider: 'claude' | 'openai' | 'ollama';
  modelId: string;
  apiKeyEnv: string;
  baseUrl?: string;
  description: string;
}

export interface SystemConfig {
  version: string;
  models: {
    default: string;
    presets: ModelPreset[];
  };
  context: {
    maxInputTokens: number;
    maxOutputTokens: number;
    knowledgeContextBudget: number;
  };
}

export const WORKSPACE_VERSION = '0.1.0';

export const defaultPresets: ModelPreset[] = [
  {
    id: 'claude-opus',
    name: 'Claude Opus 4.8',
    provider: 'claude',
    modelId: 'claude-opus-4-8',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    description: '最强能力，适合知识提取和复杂写作',
  },
  {
    id: 'claude-sonnet',
    name: 'Claude Sonnet 4.6',
    provider: 'claude',
    modelId: 'claude-sonnet-4-6',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    description: '平衡性能与成本，适合日常写作和润色',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    modelId: 'gpt-4o',
    apiKeyEnv: 'OPENAI_API_KEY',
    description: 'OpenAI 旗舰模型',
  },
  {
    id: 'ollama-local',
    name: 'Ollama 本地模型',
    provider: 'ollama',
    modelId: 'llama3.1:70b',
    apiKeyEnv: 'OLLAMA_API_KEY',
    baseUrl: 'http://localhost:11434',
    description: '本地运行，完全离线',
  },
];

export const defaultFunctionMapping: Record<string, string> = {
  extract: 'claude-opus',
  write: 'claude-opus',
  polish: 'claude-sonnet',
  brainstorm: 'claude-sonnet',
  chat: 'claude-sonnet',
};

export const defaultConfig: SystemConfig = {
  version: '0.1.0',
  models: {
    default: 'claude-sonnet',
    presets: defaultPresets,
  },
  context: {
    maxInputTokens: 100000,
    maxOutputTokens: 4096,
    knowledgeContextBudget: 30000,
  },
};
