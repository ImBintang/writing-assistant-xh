// server/src/utils/tokenizer.ts
// Token estimation utility for Chinese-heavy text.
// Uses character-type heuristics since CJK text doesn't work well with
// standard Western tokenizers. Provides reasonable estimates without
// the heavy tiktoken dependency.

/**
 * Character type categories for token estimation.
 */
enum CharType {
  CJK = 'cjk',
  LATIN = 'latin',
  DIGIT = 'digit',
  PUNCTUATION = 'punctuation',
  WHITESPACE = 'whitespace',
  OTHER = 'other',
}

// Unicode ranges
const CJK_RANGES: Array<[number, number]> = [
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0x3400, 0x4dbf], // CJK Unified Ideographs Extension A
  [0x20000, 0x2a6df], // CJK Unified Ideographs Extension B
  [0xf900, 0xfaff], // CJK Compatibility Ideographs
  [0x3000, 0x303f], // CJK Symbols and Punctuation
  [0xff00, 0xffef], // Halfwidth and Fullwidth Forms
  [0x3040, 0x309f], // Hiragana
  [0x30a0, 0x30ff], // Katakana
  [0xac00, 0xd7af], // Hangul Syllables
];

function getCharType(char: string): CharType {
  const code = char.charCodeAt(0);

  // Check CJK ranges
  for (const [start, end] of CJK_RANGES) {
    if (code >= start && code <= end) return CharType.CJK;
  }

  if (/[a-zA-Z]/.test(char)) return CharType.LATIN;
  if (/[0-9]/.test(char)) return CharType.DIGIT;
  if (/\s/.test(char)) return CharType.WHITESPACE;
  if (/[.,!?;:'"()\[\]{}，。！？；：''""（）【】《》—…\-_=+*&^%$#@~`|\\/<>]/.test(char))
    return CharType.PUNCTUATION;

  return CharType.OTHER;
}

/**
 * Estimated tokens per character type.
 * Based on observed Claude tokenizer behavior for CJK text:
 * - CJK characters ≈ 1.5–2 tokens each
 * - Latin characters ≈ 0.25–0.3 tokens each (~4 chars per token)
 * - Digits ≈ 1 token each
 * - Whitespace ≈ 0 tokens (merged with adjacent tokens)
 */
const TOKENS_PER_CHAR: Record<CharType, number> = {
  [CharType.CJK]: 1.5,
  [CharType.LATIN]: 0.3,
  [CharType.DIGIT]: 1.0,
  [CharType.PUNCTUATION]: 0.5,
  [CharType.WHITESPACE]: 0,
  [CharType.OTHER]: 1.0,
};

/**
 * Estimate the number of tokens in a given text.
 * Uses character-type heuristics optimized for Chinese text.
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count (rounded up to integer)
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) return 0;

  let tokens = 0;

  for (let i = 0; i < text.length; i++) {
    const charType = getCharType(text[i]);
    tokens += TOKENS_PER_CHAR[charType];
  }

  // Add a small overhead for token boundaries (~2%)
  tokens *= 1.02;

  return Math.ceil(tokens);
}

/**
 * Token budget tracker implementing the PRD-07 spec.
 */
export class TokenBudget {
  readonly maxInput: number;
  readonly reserved: number;

  constructor(maxInput: number, reserved: number = 0) {
    this.maxInput = maxInput;
    this.reserved = reserved;
  }

  /**
   * Available tokens (max input minus reserved overhead).
   */
  available(): number {
    return Math.max(0, this.maxInput - this.reserved);
  }

  /**
   * Estimate tokens in a text and check if it fits within the budget.
   */
  estimate(text: string): number {
    return estimateTokens(text);
  }

  /**
   * Check if a text fits within the available budget.
   */
  fits(text: string): boolean {
    return this.estimate(text) <= this.available();
  }

  /**
   * How many tokens remain after accounting for estimated text.
   */
  remaining(text: string): number {
    return this.available() - this.estimate(text);
  }

  /**
   * Create a default budget from the system config.
   */
  static fromConfig(config: {
    maxInputTokens?: number;
    maxOutputTokens?: number;
  }): TokenBudget {
    return new TokenBudget(
      config.maxInputTokens || 100000,
      config.maxOutputTokens || 4096,
    );
  }
}
