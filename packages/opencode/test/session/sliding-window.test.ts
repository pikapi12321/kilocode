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

    const result = apply(msgs, 40, "truncated", 2) as Array<{ id?: string; role: string }>

    expect(result.map((msg) => msg.id ?? msg.role)).toEqual([
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

    const result = apply(msgs, 40, "truncated", 2) as Array<{ id?: string; role: string }>

    expect(result.map((msg) => msg.id ?? msg.role)).toEqual([
      "user",
      "assistant",
      "mid-user",
      "mid-assistant",
      "new-user",
      "new-assistant",
    ])
  })
})