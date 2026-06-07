// server/src/utils/apiKeys.ts
// In-memory API key cache shared between config service and AI client modules.
//
// Purpose:
// - Breaks potential circular dependency between config.ts and client.ts
// - Provides a synchronous read path for API keys configured via UI
// - Maintains .env priority: process.env always wins over user-config keys
//
// Lifecycle:
// - Cache is populated by config.ts on server startup (from user-config.json)
// - Cache is updated by config.ts when user changes keys via API
// - Cache is read by client.ts when creating provider instances

// ==================== Cache State ====================

/** Environment variable name → key value (from user-config.json) */
let apiKeyCache: Record<string, string> = {};

// ==================== Public API ====================

/**
 * Get the effective API key for a given environment variable.
 * .env / process.env always takes priority over user-configured keys.
 *
 * @param envVar - The environment variable name (e.g., "ANTHROPIC_API_KEY")
 * @returns The effective key value, or undefined if not configured
 */
export function getEffectiveApiKey(envVar: string): string | undefined {
  return process.env[envVar] || apiKeyCache[envVar];
}

/**
 * Replace the entire cache atomically.
 * Used on initial load from user-config.json and after save.
 */
export function setApiKeyCache(keys: Record<string, string>): void {
  apiKeyCache = { ...keys };
}

/**
 * Remove a single key from the cache.
 * Called during delete operations.
 */
export function clearApiKeyFromCache(envVar: string): void {
  delete apiKeyCache[envVar];
}

/**
 * Return a shallow snapshot of the current cache.
 * Used by getApiKeyStatus() without exposing the full cache.
 */
export function getApiKeyCacheSnapshot(): Record<string, string> {
  return { ...apiKeyCache };
}
