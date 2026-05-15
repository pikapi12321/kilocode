// kilocode_change - new file: built-in agent type defaults registry
export * as AgentType from "./agent-type"

import type { InstanceType } from "./agent-instance"

/**
 * Default role injected for long-task agents when neither `role` nor
 * `role_file` is configured on the instance.
 */
export const DEFAULT_LONG_TASK_ROLE = `You are a persistent autonomous agent working on a long-running task.

Your task is defined in the first message of this conversation. Keep it in mind throughout.

Do not wait for user confirmation between steps. Continue autonomously until the task is complete or you reach a decision point that requires human judgment.`

/**
 * Runtime defaults derived from an agent's base type.
 *
 *   use_sliding_window       — whether this type forces sliding-window compaction on
 *   allow_auto_compaction    — false means auto compaction is permanently blocked (runtime enforcement)
 *   protectFirstUserMessage  — when true, the first user message survives sliding-window cuts
 *   tail_turns               — default number of recent turns to keep verbatim
 *   default_role             — fallback role text when the instance provides no role/role_file
 */
export type Defaults = {
  use_sliding_window: boolean
  allow_auto_compaction: boolean
  protectFirstUserMessage: boolean
  tail_turns: number
  default_role?: string
}

const DEFAULTS: Record<InstanceType, Defaults> = {
  "long-task": {
    use_sliding_window: true,
    allow_auto_compaction: false, // enforced by omitting this flag from CompactionOverrides schema
    protectFirstUserMessage: true,
    tail_turns: 2,
    default_role: DEFAULT_LONG_TASK_ROLE,
  },
  code: {
    use_sliding_window: false,
    allow_auto_compaction: true,
    protectFirstUserMessage: false,
    tail_turns: 2,
  },
  plan: {
    use_sliding_window: false,
    allow_auto_compaction: true,
    protectFirstUserMessage: false,
    tail_turns: 2,
  },
  ask: {
    use_sliding_window: false,
    allow_auto_compaction: true,
    protectFirstUserMessage: false,
    tail_turns: 2,
  },
  debug: {
    use_sliding_window: false,
    allow_auto_compaction: true,
    protectFirstUserMessage: false,
    tail_turns: 2,
  },
}

/**
 * Return the built-in type defaults for a given type string.
 * Falls back to the "code" defaults for unknown types.
 */
export function get(type: string): Defaults {
  return (DEFAULTS as Record<string, Defaults>)[type] ?? DEFAULTS["code"]
}
