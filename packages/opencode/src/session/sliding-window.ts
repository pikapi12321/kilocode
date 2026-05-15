// kilocode_change - new file
import { Token } from "@/util/token"

type ModelMessage = { role: string; content: unknown }

export type ApplyResult = {
  messages: ModelMessage[]
  overflow: boolean
}

export const DEFAULT_TAIL_TURNS = 2

function estimate(message: ModelMessage) {
  return Token.estimate(JSON.stringify(message))
}

function marker(marker: string): ModelMessage[] {
  return [
    {
      role: "user",
      content: [{ type: "text", text: marker }],
    },
    {
      role: "assistant",
      content: [{ type: "text", text: "Understood." }],
    },
  ]
}

function totalTokens(messages: ModelMessage[]) {
  return messages.reduce((sum, msg) => sum + estimate(msg), 0)
}

function build(messages: ModelMessage[], text: string, start: number, firstUserIdx: number | undefined) {
  return [
    ...(firstUserIdx === undefined ? [] : [messages[firstUserIdx]!]),
    ...marker(text),
    ...messages.slice(start),
  ]
}

export function clamp(input: { requested: number; usable: number; reserve: number }) {
  if (input.usable <= 0) return input.requested
  return Math.max(1, Math.min(input.requested, Math.max(1, input.usable - input.reserve)))
}

function findTurn(messages: ModelMessage[], keep: number) {
  if (keep <= 0) return -1
  const users = messages.flatMap((msg, i) => (msg.role === "user" ? [i] : []))
  if (users.length === 0) return -1
  return users[Math.max(0, users.length - keep)]!
}

export function apply(
  messages: ModelMessage[],
  tokenBudget: number,
  text: string,
  keep = DEFAULT_TAIL_TURNS,
  // kilocode_change start - protect the user's first message across sliding-window cuts
  protectFirstUserMessage = false,
  // kilocode_change end
): ApplyResult {
  let total = 0
  let cut = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    const next = total + estimate(messages[i]!)
    if (next > tokenBudget) {
      cut = i + 1
      break
    }
    total = next
  }

  if (cut === 0) return { messages, overflow: false }

  const nextUser = messages.findIndex((msg, i) => i >= cut && msg.role === "user")
  const aligned = nextUser !== -1 ? nextUser : messages.findLastIndex((msg) => msg.role === "user")
  const preserved = findTurn(messages, keep)
  const start = aligned === -1 ? preserved : preserved === -1 ? aligned : Math.min(aligned, preserved)
  if (start <= 0) return { messages, overflow: false }

  if (!protectFirstUserMessage) {
    return { messages: [...marker(text), ...messages.slice(start)], overflow: false }
  }

  const firstUserIdx = protectFirstUserMessage ? messages.findIndex((msg) => msg.role === "user") : -1
  let nextStart = start

  while (true) {
    const preservedFirst = firstUserIdx !== -1 && firstUserIdx < nextStart ? firstUserIdx : undefined
    const next = build(messages, text, nextStart, preservedFirst)
    if (totalTokens(next) <= tokenBudget) return { messages: next, overflow: false }

    const later = messages.findIndex((msg, i) => i > nextStart && msg.role === "user")
    if (later === -1) {
      const minimal = build(messages, text, messages.length, preservedFirst)
      return { messages: minimal, overflow: totalTokens(minimal) > tokenBudget }
    }

    nextStart = later
  }
}
