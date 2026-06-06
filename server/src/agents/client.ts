// server/src/agents/client.ts
// AI Client abstraction layer with multi-provider support.
// Supports Claude (Anthropic), OpenAI, and Ollama backends.
// Currently ClaudeProvider is fully implemented; OpenAI/Ollama are stub placeholders.

import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../utils/logger';
import {
  defaultConfig,
  defaultPresets,
  defaultFunctionMapping,
  type ModelPreset,
} from '../config/default';
import { fileExists, forceReadFile } from '../utils/file';
import type { ExtractionInput, ExtractionOutput, RawKnowledgeEntry } from '../types/knowledge';

const logger = createLogger('agent-client');

// ==================== Unified Interfaces ====================

/** A content block returned by any provider. */
export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id?: string;
  name: string;
  input: Record<string, unknown>;
}

export type ContentBlock = TextBlock | ToolUseBlock;

/** Unified chat completion parameters. */
export interface ChatParams {
  model: string;
  maxTokens: number;
  temperature: number;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools?: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;
  toolChoice?: { type: 'tool'; name: string };
  signal?: AbortSignal;
}

/** Unified chat completion result. */
export interface ChatResult {
  content: ContentBlock[];
  usage: { inputTokens: number; outputTokens: number };
}

// ==================== Provider Interface ====================

/** Abstract AI provider interface. */
export interface AiProvider {
  readonly name: string;
  chat(params: ChatParams): Promise<ChatResult>;
}

// ==================== Claude Provider (Anthropic) ====================

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    anthropicClient = new Anthropic({ apiKey });
    logger.info('Anthropic client initialized');
  }
  return anthropicClient;
}

class ClaudeProvider implements AiProvider {
  readonly name = 'claude';

  async chat(params: ChatParams): Promise<ChatResult> {
    const client = getAnthropicClient();

    // Convert unified tools to Anthropic format
    const anthropicTools = params.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
    }));

    const response = await client.messages.create(
      {
        model: params.model,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        system: params.system,
        messages: params.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        ...(anthropicTools ? { tools: anthropicTools } : {}),
        ...(params.toolChoice
          ? { tool_choice: params.toolChoice as Anthropic.MessageCreateParams['tool_choice'] }
          : {}),
      },
      { signal: params.signal },
    );

    // Convert Anthropic response blocks to unified format
    const content: ContentBlock[] = response.content.map((block) => {
      if (block.type === 'text') {
        return { type: 'text', text: block.text };
      }
      if (block.type === 'tool_use') {
        return {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        };
      }
      // Unknown block type — skip
      return { type: 'text', text: '' };
    });

    return {
      content,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}

// ==================== OpenAI Provider (Stub) ====================

class OpenAIProvider implements AiProvider {
  readonly name = 'openai';

  async chat(_params: ChatParams): Promise<ChatResult> {
    throw new Error(
      'OpenAI provider is not yet implemented. Please install the `openai` SDK and configure an OpenAI API key.',
    );
  }
}

// ==================== Ollama Provider (Stub) ====================

class OllamaProvider implements AiProvider {
  readonly name = 'ollama';

  async chat(_params: ChatParams): Promise<ChatResult> {
    throw new Error(
      'Ollama provider is not yet implemented. Please ensure Ollama is running locally and configured correctly.',
    );
  }
}

// ==================== Provider Factory ====================

const providerCache = new Map<string, AiProvider>();

function getProvider(providerType: string): AiProvider {
  const cached = providerCache.get(providerType);
  if (cached) return cached;

  let provider: AiProvider;
  switch (providerType) {
    case 'claude':
      provider = new ClaudeProvider();
      break;
    case 'openai':
      provider = new OpenAIProvider();
      break;
    case 'ollama':
      provider = new OllamaProvider();
      break;
    default:
      throw new Error(`Unknown AI provider type: ${providerType}`);
  }

  providerCache.set(providerType, provider);
  return provider;
}

// ==================== Model Resolution ====================

/** Load user config overrides for function mapping. */
async function loadUserFunctionMapping(): Promise<Record<string, string>> {
  try {
    const exists = await fileExists('user-config.json');
    if (exists) {
      const raw = await forceReadFile('user-config.json');
      const userConfig = JSON.parse(raw);
      if (userConfig.functionMapping) {
        return { ...defaultFunctionMapping, ...userConfig.functionMapping };
      }
    }
  } catch {
    // Fall through to defaults
  }
  return { ...defaultFunctionMapping };
}

/** Load all custom model presets from user config. */
async function loadCustomPresets(): Promise<ModelPreset[]> {
  try {
    const exists = await fileExists('user-config.json');
    if (exists) {
      const raw = await forceReadFile('user-config.json');
      const userConfig = JSON.parse(raw);
      if (userConfig.models?.customPresets && Array.isArray(userConfig.models.customPresets)) {
        return userConfig.models.customPresets as ModelPreset[];
      }
    }
  } catch {
    // Fall through
  }
  return [];
}

/** All available presets (default + user custom), built lazily. */
let allPresetsCache: ModelPreset[] | null = null;
let functionMappingCache: Record<string, string> | null = null;

async function getAllPresets(): Promise<ModelPreset[]> {
  if (!allPresetsCache) {
    const custom = await loadCustomPresets();
    allPresetsCache = [...defaultPresets, ...custom];
  }
  return allPresetsCache;
}

async function getFunctionMapping(): Promise<Record<string, string>> {
  if (!functionMappingCache) {
    functionMappingCache = await loadUserFunctionMapping();
  }
  return functionMappingCache;
}

/** Invalidate caches (call after config changes). */
export function invalidateModelCache(): void {
  allPresetsCache = null;
  functionMappingCache = null;
  providerCache.clear();
}

/**
 * Resolve a function mode to model ID and provider.
 *
 * Lookup chain:
 * 1. Function mapping (user overrides > default mapping) → preset ID
 * 2. Preset ID → ModelPreset (user custom > built-in)
 * 3. ModelPreset → modelId + provider type
 *
 * @param mode - Function mode ('write', 'polish', 'chat', 'extract', 'brainstorm', 'skill_generate')
 * @returns { modelId, providerName, presetId }
 */
export async function resolveModel(
  mode: string,
): Promise<{ modelId: string; providerName: string; presetId: string }> {
  const mapping = await getFunctionMapping();
  const presetId = mapping[mode] || defaultConfig.models.default;

  const presets = await getAllPresets();
  const preset = presets.find((p) => p.id === presetId);

  if (!preset) {
    // Fallback to default model if preset not found
    const fallback = defaultPresets.find((p) => p.id === defaultConfig.models.default);
    if (!fallback) {
      throw new Error('No model preset configured');
    }
    logger.warn(
      `Preset "${presetId}" not found for mode "${mode}", falling back to ${fallback.id}`,
    );
    return {
      modelId: fallback.modelId,
      providerName: fallback.provider,
      presetId: fallback.id,
    };
  }

  return {
    modelId: preset.modelId,
    providerName: preset.provider,
    presetId: preset.id,
  };
}

/**
 * Get an AiProvider instance for a given mode.
 * Loads user config overrides for function mapping and custom presets.
 */
export async function getProviderForMode(mode: string): Promise<{
  provider: AiProvider;
  modelId: string;
  presetId: string;
}> {
  const { modelId, providerName, presetId } = await resolveModel(mode);
  const provider = getProvider(providerName);
  return { provider, modelId, presetId };
}

// Backward-compatible synchronous getClient (for code that hasn't migrated yet)
export function getClient(): Anthropic {
  return getAnthropicClient();
}

// ==================== Extraction Helper ====================

/**
 * Sanitize a schema name for use as a tool name.
 */
function sanitizeToolName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'extract_knowledge';
}

/**
 * Parse the tool_use response into an array of RawKnowledgeEntry.
 */
function parseToolResponse(block: ToolUseBlock): RawKnowledgeEntry[] {
  try {
    const raw = block.input;

    if (raw && Array.isArray(raw.entries)) {
      return raw.entries as RawKnowledgeEntry[];
    }

    if (raw && typeof raw === 'object' && 'name' in raw) {
      return [raw as unknown as RawKnowledgeEntry];
    }

    logger.warn(
      'Tool response did not contain expected entries array, got:',
      JSON.stringify(raw).slice(0, 200),
    );
    return [];
  } catch (err) {
    logger.error('Failed to parse tool response:', err);
    return [];
  }
}

/**
 * Run a single knowledge extraction call using the appropriate provider.
 */
export async function runExtraction(
  input: ExtractionInput,
): Promise<ExtractionOutput> {
  const startTime = Date.now();

  // Resolve model for extraction mode
  const { provider, modelId } = await getProviderForMode('extract');
  // Allow explicit modelId override from input
  const effectiveModelId = input.modelId || modelId;

  const toolName = sanitizeToolName(`extract_${input.chapterIndex}`);

  logger.info(
    `Starting extraction: chapter="${input.chapterTitle}" (idx=${input.chapterIndex}), model=${effectiveModelId}, provider=${provider.name}`,
  );

  try {
    const result = await provider.chat({
      model: effectiveModelId,
      maxTokens: 4096,
      temperature: 0.1,
      system: input.systemPrompt,
      messages: [
        {
          role: 'user',
          content: `## 章节信息\n- 标题：${input.chapterTitle}\n- 序号：第${input.chapterIndex}章\n\n## 章节内容\n${input.chapterContent}`,
        },
      ],
      tools: [
        {
          name: toolName,
          description: '提取本章节中的知识条目，返回结构化的知识条目数组。如果没有可提取的内容，返回空数组。',
          inputSchema: input.outputSchema as Record<string, unknown>,
        },
      ],
      toolChoice: { type: 'tool', name: toolName },
    });

    const toolUseBlocks = result.content.filter(
      (c): c is ToolUseBlock => c.type === 'tool_use',
    );

    const tokensUsed = result.usage.inputTokens + result.usage.outputTokens;

    if (toolUseBlocks.length === 0) {
      logger.warn(
        `No tool_use block in response for chapter="${input.chapterTitle}". Returning empty.`,
      );
      return { entries: [], tokensUsed, durationMs: Date.now() - startTime };
    }

    const entries = parseToolResponse(toolUseBlocks[0]);
    const durationMs = Date.now() - startTime;

    logger.info(
      `Extraction complete: chapter="${input.chapterTitle}", entries=${entries.length}, tokens=${tokensUsed}, duration=${durationMs}ms`,
    );

    return { entries, tokensUsed, durationMs };
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);

    if (err instanceof Error && err.name === 'AbortError') {
      logger.info(`Extraction aborted: chapter="${input.chapterTitle}"`);
      throw err;
    }

    logger.error(
      `Extraction failed: chapter="${input.chapterTitle}", error="${errorMsg}", duration=${durationMs}ms`,
    );
    throw err;
  }
}

/**
 * Retry wrapper with exponential backoff.
 */
export async function runExtractionWithRetry(
  input: ExtractionInput,
  maxRetries: number = 3,
): Promise<ExtractionOutput> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await runExtraction(input);
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (lastError.name === 'AbortError') throw lastError;

      const statusMatch = lastError.message.match(/status: (\d+)/);
      if (statusMatch) {
        const status = parseInt(statusMatch[1], 10);
        if (status >= 400 && status < 500) {
          logger.warn(`Non-retryable error (${status}), not retrying`);
          throw lastError;
        }
      }

      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000;
        logger.warn(
          `Extraction attempt ${attempt + 1}/${maxRetries + 1} failed: ${lastError.message}. Retrying in ${delayMs}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}
