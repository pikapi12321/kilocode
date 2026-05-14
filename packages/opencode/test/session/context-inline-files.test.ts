// kilocode_change - new file
import { describe, expect, test } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import { buildContextFilesBlock } from "../../src/session/context-inline-files"

describe("session context inline files", () => {
  test("skips absolute paths outside the project root", async () => {
    await using root = await tmpdir()
    await using other = await tmpdir({
      init: async (dir) => {
        const file = path.join(dir, "secret.txt")
        await Bun.write(file, "secret")
        return file
      },
    })

    const block = await buildContextFilesBlock(
      [
        {
          path: other.extra,
          description: "secret",
        },
      ],
      root.path,
    )

    expect(block).toBeUndefined()
  })

  test("skips relative paths that escape the project root", async () => {
    await using root = await tmpdir()
    await using other = await tmpdir({
      init: async (dir) => {
        const file = path.join(dir, "secret.txt")
        await Bun.write(file, "secret")
        return file
      },
    })

    const rel = path.relative(root.path, other.extra)
    expect(rel.startsWith("..") || rel.includes(`..${path.sep}`)).toBe(true)

    const block = await buildContextFilesBlock(
      [
        {
          path: rel,
          description: "secret",
        },
      ],
      root.path,
    )

    expect(block).toBeUndefined()
  })

  test("truncates oversized file content before inlining it", async () => {
    await using root = await tmpdir({
      init: async (dir) => {
        const file = path.join(dir, "memory.md")
        const text = ["OLD-ENTRY", "a".repeat(1200), "LATEST-ENTRY"].join("\n")
        await Bun.write(file, text)
      },
    })

    const block = await buildContextFilesBlock(
      [
        {
          path: "memory.md",
          description: "memory",
          max_tokens: 50,
          compress_ratio: 0.5,
        },
      ],
      root.path,
    )

    expect(block).toBeTruthy()
    expect(block).toContain("Only the newest ~50 tokens are inlined below to protect context")
    expect(block).toContain("LATEST-ENTRY")
    expect(block).not.toContain("OLD-ENTRY")
    expect(block).toContain("Earlier file content omitted to fit context")
  })
})