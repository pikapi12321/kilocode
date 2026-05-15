// kilocode_change - new file: typed agent instance schema for agents[] array in kilo.jsonc
export * as AgentInstance from "./agent-instance"

import { Schema } from "effect"
import { NonNegativeInt, PositiveInt } from "@/util/schema"
import { ConfigModelID } from "./model-id"

const ContextInlineFileBase = {
  path: Schema.String.annotate({
    description: "Path relative to the project worktree root.",
  }),
  max_tokens: Schema.optional(NonNegativeInt).annotate({
    description: "Soft token cap. Content beyond this limit is truncated and the LLM is asked to compress.",
  }),
  compress_ratio: Schema.optional(Schema.Number).annotate({
    description: "Target size after compression as a fraction of max_tokens (default 0.5).",
  }),
}

/**
 * Names valid as keys in agent.* config for overriding built-in agent settings.
 * These are the actual registered agent names (not type identifiers like "long-task").
 */
export const VALID_AGENT_CONFIG_KEYS = new Set([
  "code",
  "build", // legacy alias for "code"
  "plan",
  "debug",
  "ask",
  "orchestrator",
  "general",
  "explore",
  "compaction",
  "title",
  "summary",
])

/**
 * Built-in agent names (and their known aliases) that must not be used as
 * user-defined agent instance names.  These are the actual names registered
 * by agent/agent.ts and kilocode/agent/index.ts.
 * Superset of VALID_AGENT_CONFIG_KEYS — adds "long-task" which is a type
 * identifier, not a configurable agent key.
 */
export const BUILTIN_AGENT_NAMES = new Set([...VALID_AGENT_CONFIG_KEYS, "long-task"])

/**
 * The valid base types a user-defined agent instance can inherit from.
 * "long-task" is a new Kilo-specific type; the rest map to existing built-in agents.
 */
export const INSTANCE_TYPES = ["long-task", "code", "plan", "ask", "debug"] as const
export type InstanceType = (typeof INSTANCE_TYPES)[number]

/**
 * Schema for a single context file entry.
 * Used by per-agent instance overrides.
 */
export const ContextInlineFileSpec = Schema.Struct({
  ...ContextInlineFileBase,
  description: Schema.optional(Schema.String).annotate({
    description: "Purpose shown to the LLM so it knows when and how to update this file.",
  }),
})
export type ContextInlineFileSpec = Schema.Schema.Type<typeof ContextInlineFileSpec>

/**
 * Schema for the global context_inline_files config.
 * Global entries keep description required so the working-memory purpose is explicit.
 */
export const GlobalContextInlineFileSpec = Schema.Struct({
  ...ContextInlineFileBase,
  description: Schema.String.annotate({
    description: "Purpose shown to the LLM so it knows when and how to update this file.",
  }),
})
export type GlobalContextInlineFileSpec = Schema.Schema.Type<typeof GlobalContextInlineFileSpec>

/**
 * Per-instance compaction overrides.
 * Note: auto compaction is intentionally absent — it is prohibited for
 * long-task agents and not meaningful to configure per-instance for other types.
 */
export const CompactionOverrides = Schema.Struct({
  sliding_window_tokens: Schema.optional(PositiveInt).annotate({
    description: "Maximum tokens of recent messages to keep (overrides global sliding_window_tokens).",
  }),
  tail_turns: Schema.optional(NonNegativeInt).annotate({
    description: "Recent user turns to preserve verbatim (overrides global tail_turns).",
  }),
  sliding_window_marker: Schema.optional(Schema.String).annotate({
    description: "Custom truncation marker shown to the LLM when older messages are dropped.",
  }),
})
export type CompactionOverrides = Schema.Schema.Type<typeof CompactionOverrides>

/**
 * A user-defined agent instance.  Instances inherit defaults from their base
 * `type` and can override model, role, context files, and compaction settings.
 */
const InfoBase = Schema.Struct({
  name: Schema.String.annotate({
    description:
      "Unique name for this agent instance. Must not clash with built-in agent names " +
      "(code, build, plan, debug, ask, orchestrator, general, explore, compaction, title, summary, long-task).",
  }),
  type: Schema.Literals(INSTANCE_TYPES).annotate({
    description:
      "Base type this instance inherits defaults from. " +
      "'long-task' enables sliding-window compaction and first-user-message protection. " +
      "Other types map to the corresponding built-in agent.",
  }),
  description: Schema.optional(Schema.String).annotate({
    description: "Short description shown in the agent selector.",
  }),

  // Role — exactly one of role / role_file, both optional
  role: Schema.optional(Schema.String).annotate({
    description:
      "Inline role system prompt injected at session start (after instructions, before context files). " +
      "Used when role_file is not set.",
  }),
  role_file: Schema.optional(Schema.String).annotate({
    description:
      "Path to a role file relative to the worktree root. " +
      "Takes priority over role when set. The file is read fresh each session.",
  }),

  // Context files — agent-instance-scoped, completely replaces global context_inline_files
  context_inline_files: Schema.optional(Schema.Array(ContextInlineFileSpec)).annotate({
    description:
      "Files inlined into every prompt as working memory for this agent instance. " +
      "When set, completely replaces the global context_inline_files (no merging). " +
      "Primarily used with long-task agents.",
  }),

  compaction: Schema.optional(CompactionOverrides).annotate({
    description:
      "Compaction settings for this agent instance (overrides global compaction config). " +
      "For long-task agents, auto compaction is never permitted regardless of global config.",
  }),

  model: Schema.optional(ConfigModelID).annotate({
    description:
      "Model override in 'provider/model-name' format. Supports any provider (e.g. 'anthropic/claude-opus-4-5', " +
      "'deepseek/deepseek-v3'). Falls back to the type default, then global default.",
  }),
})
export const Info = InfoBase.check(
  Schema.makeFilter((value: Schema.Schema.Type<typeof InfoBase>) =>
    value.role && value.role_file ? "role and role_file are mutually exclusive" : undefined,
  ),
)
  .annotate({ identifier: "AgentInstance" })

export type Info = Schema.Schema.Type<typeof Info>

export function selectRole(
  instance: Pick<Info, "role" | "role_file"> | undefined,
  fallback?: string,
):
  | { kind: "file"; value: string }
  | { kind: "inline"; value: string }
  | undefined {
  if (!instance) return fallback ? { kind: "inline", value: fallback } : undefined
  if (instance.role_file) return { kind: "file", value: instance.role_file }
  if (instance.role) return { kind: "inline", value: instance.role }
  if (fallback) return { kind: "inline", value: fallback }
  return undefined
}

export function selectContextFiles<T>(instance: { context_inline_files?: T } | undefined, global: T | undefined): T | undefined {
  if (instance) return instance.context_inline_files
  return global
}
