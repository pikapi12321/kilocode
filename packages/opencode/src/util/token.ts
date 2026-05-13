// Rough token estimation without a full tokenizer.
//
// English/Latin text averages ~4 characters per token, but CJK scripts
// (Chinese, Japanese, Korean) average ~1 character per token in modern LLMs.
// Using a flat chars/4 for everything causes ~4-6× underestimation for CJK,
// which makes tail-turn selection and pruning keep far more Chinese context
// than the configured token budgets intend.
//
// Strategy: iterate over Unicode code points (for...of handles surrogate pairs
// correctly), accumulate per-character token weight, and round at the end.

const ASCII_CHARS_PER_TOKEN = 4

/**
 * Returns true for code points that map to roughly 1 token per character
 * in modern LLM tokenizers (CJK ideographs, kana, Hangul, etc.).
 */
function isCJKCodePoint(cp: number): boolean {
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified Ideographs (common)
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Extension A
    (cp >= 0x20000 && cp <= 0x2a6df) || // CJK Extension B (supplementary)
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK Compatibility Ideographs
    (cp >= 0x3000 && cp <= 0x303f) || // CJK Symbols and Punctuation
    (cp >= 0x3040 && cp <= 0x309f) || // Hiragana
    (cp >= 0x30a0 && cp <= 0x30ff) || // Katakana
    (cp >= 0xac00 && cp <= 0xd7af) || // Hangul Syllables
    (cp >= 0x1100 && cp <= 0x11ff) || // Hangul Jamo
    (cp >= 0xff00 && cp <= 0xffef) // Halfwidth and Fullwidth Forms
  )
}

export function estimate(input: string): number {
  if (!input) return 0
  // Accumulate token-equivalent weight for each code point.
  // CJK chars get weight ASCII_CHARS_PER_TOKEN (= 1 token each).
  // Everything else keeps its UTF-16 width so surrogate pairs preserve the
  // previous rough estimate (e.g. emoji still count like two code units).
  let weight = 0
  for (const char of input) {
    const cp = char.codePointAt(0)!
    weight += isCJKCodePoint(cp) ? ASCII_CHARS_PER_TOKEN : char.length
  }
  return Math.max(0, Math.round(weight / ASCII_CHARS_PER_TOKEN))
}

export * as Token from "./token"
