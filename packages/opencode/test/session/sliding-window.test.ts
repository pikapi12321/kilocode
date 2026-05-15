// kilocode_change - new file
import { describe, expect, test } from "bun:test"
import { apply, clamp } from "../../src/session/sliding-window"

describe("session sliding window", () => {
  test("clamps requested budget to usable context after reserve", () => {
    expect(
      clamp({
        requested: 40_000,
        usable: 1_024,
        reserve: 256,
      }),
    ).toBe(768)
  })

  test("keeps configured tail turns when the latest user message exceeds the budget", () => {
    const msgs = [
      { id: "old-user", role: "user", content: [{ type: "text", text: "old" }] },
      { id: "old-assistant", role: "assistant", content: [{ type: "text", text: "done" }] },
      { id: "mid-user", role: "user", content: [{ type: "text", text: "mid" }] },
      { id: "mid-assistant", role: "assistant", content: [{ type: "text", text: "ok" }] },
      { id: "new-user", role: "user", content: [{ type: "text", text: "x".repeat(400) }] },
    ]

    const result = apply(msgs, 40, "truncated", 2)

    expect(result.overflow).toBe(false)
    expect(result.messages.map((msg) => (msg as { id?: string; role: string }).id ?? msg.role)).toEqual([
      "user",
      "assistant",
      "mid-user",
      "mid-assistant",
      "new-user",
    ])
  })

  test("keeps configured tail turns when truncation lands inside the latest assistant turn", () => {
    const msgs = [
      { id: "old-user", role: "user", content: [{ type: "text", text: "old" }] },
      { id: "old-assistant", role: "assistant", content: [{ type: "text", text: "done" }] },
      { id: "mid-user", role: "user", content: [{ type: "text", text: "mid" }] },
      { id: "mid-assistant", role: "assistant", content: [{ type: "text", text: "ok" }] },
      { id: "new-user", role: "user", content: [{ type: "text", text: "fresh" }] },
      { id: "new-assistant", role: "assistant", content: [{ type: "text", text: "y".repeat(400) }] },
    ]

    const result = apply(msgs, 40, "truncated", 2)

    expect(result.overflow).toBe(false)
    expect(result.messages.map((msg) => (msg as { id?: string; role: string }).id ?? msg.role)).toEqual([
      "user",
      "assistant",
      "mid-user",
      "mid-assistant",
      "new-user",
      "new-assistant",
    ])
  })

  test("drops more history to preserve the first user message when requested", () => {
    const msgs = [
      { id: "task-user", role: "user", content: [{ type: "text", text: "task" }] },
      { id: "task-assistant", role: "assistant", content: [{ type: "text", text: "ok" }] },
      { id: "mid-user", role: "user", content: [{ type: "text", text: "m".repeat(160) }] },
      { id: "mid-assistant", role: "assistant", content: [{ type: "text", text: "done" }] },
      { id: "new-user", role: "user", content: [{ type: "text", text: "fresh" }] },
      { id: "new-assistant", role: "assistant", content: [{ type: "text", text: "reply" }] },
    ]

    const result = apply(msgs, 120, "truncated", 2, true)

    expect(result.overflow).toBe(false)
    expect(result.messages.map((msg) => (msg as { id?: string; role: string }).id ?? msg.role)).toEqual([
      "task-user",
      "user",
      "assistant",
      "new-user",
      "new-assistant",
    ])
  })

  test("reports overflow when the protected first user message still cannot fit", () => {
    const msgs = [
      { id: "task-user", role: "user", content: [{ type: "text", text: "x".repeat(500) }] },
      { id: "task-assistant", role: "assistant", content: [{ type: "text", text: "ok" }] },
      { id: "new-user", role: "user", content: [{ type: "text", text: "fresh" }] },
    ]

    const result = apply(msgs, 40, "truncated", 1, true)

    expect(result.overflow).toBe(true)
    expect(result.messages.map((msg) => (msg as { id?: string; role: string }).id ?? msg.role)).toEqual([
      "task-user",
      "user",
      "assistant",
    ])
  })
})