// kilocode_change - new file: inline persistent context files into every prompt

import fs from "fs/promises"
import path from "path"
import { Token } from "@/util/token"
import type { Config } from "@/config/config"
import * as Filesystem from "@/util/filesystem"

export type ContextFileSpec = NonNullable<Config.Info["context_inline_files"]>[number]

const DEFAULT_COMPRESS_RATIO = 0.5

/**
 * Resolve a configured path to an absolute path anchored at the project root.
 * Absolute, ~/, and escaping relative paths are rejected.
 */
export function resolvePath(filePath: string, worktree: string): string | undefined {
  if (filePath.startsWith("~/") || path.isAbsolute(filePath)) return undefined
  const root = Filesystem.resolve(worktree)
  const resolved = Filesystem.resolve(path.resolve(root, filePath))
  return Filesystem.contains(root, resolved) ? resolved : undefined
}

/**
 * Read a single context file and return its current content, or an empty
 * string if the file does not yet exist.
 */
async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8")
  } catch {
    return ""
  }
}

function truncate(content: string, maxTokens: number) {
  const total = Token.estimate(content)
  if (total <= maxTokens) return { text: content, total, truncated: false }

  let low = 0
  let high = content.length
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    const slice = content.slice(mid)
    if (Token.estimate(slice) > maxTokens) low = mid + 1
    else high = mid
  }

  const text = content.slice(low)
  return { text, total, truncated: true }
}

/**
 * Build the system-prompt block for a single context file entry.
 *
 * Format:
 *   [Context file: <path> — <description>]
 *   <content or "(file does not exist yet — create it when you have relevant information)">
 *
 * Includes a compression directive when the file is over the size cap.
 */
function renderEntry(spec: ContextFileSpec, resolvedPath: string, content: string): string {
  const maxTokens = spec.max_tokens
  const ratio = spec.compress_ratio ?? DEFAULT_COMPRESS_RATIO
  const targetTokens = maxTokens ? Math.floor(maxTokens * ratio) : undefined
  const next = maxTokens !== undefined ? truncate(content, maxTokens) : { text: content, total: Token.estimate(content), truncated: false }

  const header = `[Context file: ${resolvedPath} — ${spec.description}]`

  const body = content.trim()
    ? next.truncated
      ? [
          "(Earlier file content omitted to fit context. Read the file directly if you need older entries before compressing it.)",
          next.text,
        ].join("\n")
      : next.text
    : "(file does not exist yet — create it with the write tool when you have relevant information to record)"

  const sizeWarning =
    maxTokens !== undefined && next.total > maxTokens
      ? `\n⚠ This file is ${next.total} tokens, exceeding the ${maxTokens}-token limit. ` +
        `Only the newest ~${maxTokens} tokens are inlined below to protect context. ` +
        `You MUST compress it to ~${targetTokens} tokens during this turn using the edit tool, ` +
        `preserving all critical information while removing redundancy and superseded entries.`
      : ""

  return [header + sizeWarning, body].join("\n")
}

/**
 * Build the full system-prompt injection for all configured context_inline_files.
 * Returns undefined when the list is empty.
 */
export async function buildContextFilesBlock(
  specs: ContextFileSpec[],
  worktree: string,
): Promise<string | undefined> {
  if (specs.length === 0) return undefined

  const entries = await Promise.all(
    specs.map(async (spec) => {
      const resolved = resolvePath(spec.path, worktree)
      if (!resolved) return undefined
      const content = await readFile(resolved)
      return renderEntry(spec, resolved, content)
    }),
  )
  const valid = entries.filter((entry): entry is string => Boolean(entry))
  if (valid.length === 0) return undefined

  const preamble = [
    "## Persistent context files",
    "",
    "The following files are your long-term working memory for this project.",
    "Their contents are injected fresh into every prompt so they stay current.",
    "Your responsibilities:",
    "  • After every turn where you make a new finding, decision, or observation,",
    "    update the relevant file immediately using the edit or write tool.",
    "  • When a file exceeds its size limit (indicated by the ⚠ warning above its",
    "    content), compress it during the same turn before doing any other work.",
    "  • Keep entries concise and factual. Remove entries that are no longer relevant.",
  ].join("\n")

  return [preamble, "", ...valid].join("\n\n")
}

export * as ContextInlineFiles from "./context-inline-files"
