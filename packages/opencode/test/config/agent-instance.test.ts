import { describe, expect, test } from "bun:test"
import { Result, Schema } from "effect"
import { AgentInstance } from "../../src/config/agent-instance"

const parse = Schema.decodeUnknownSync(AgentInstance.Info)

describe("AgentInstance", () => {
  test("rejects role and role_file being set together", () => {
    expect(() =>
      parse({
        name: "researcher",
        type: "long-task",
        role: "inline",
        role_file: "ROLE.md",
      }),
    ).toThrow()
  })

  test("prefers role_file over inline role and default role", () => {
    expect(
      AgentInstance.selectRole(
        {
          role: "inline",
          role_file: "ROLE.md",
        },
        "fallback",
      ),
    ).toEqual({ kind: "file", value: "ROLE.md" })
  })

  test("typed agents without context files do not inherit the global list", () => {
    const global = [{ path: "memory.md", description: "memory" }]

    expect(AgentInstance.selectContextFiles({ context_inline_files: undefined }, global)).toBeUndefined()
    expect(AgentInstance.selectContextFiles(undefined, global)).toBe(global)
  })

  test("keeps description required for global context files but optional for agent overrides", () => {
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(AgentInstance.GlobalContextInlineFileSpec)({
          path: "memory.md",
          description: "memory",
        }),
      ),
    ).toBe(true)

    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(AgentInstance.GlobalContextInlineFileSpec)({
          path: "memory.md",
        }),
      ),
    ).toBe(false)

    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(AgentInstance.ContextInlineFileSpec)({
          path: "memory.md",
        }),
      ),
    ).toBe(true)
  })
})