import { describe, expect, test } from "bun:test"
import { ACP } from "../../src/acp/agent"
import type { AgentSideConnection } from "@agentclientprotocol/sdk"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"

type SessionUpdateParams = Parameters<AgentSideConnection["sessionUpdate"]>[0]
type RequestPermissionParams = Parameters<AgentSideConnection["requestPermission"]>[0]
type RequestPermissionResult = Awaited<ReturnType<AgentSideConnection["requestPermission"]>>

type GlobalEventEnvelope = {
  payload?: unknown
}

type EventController = {
  close: () => void
}

function createEventStream() {
  const queue: GlobalEventEnvelope[] = []
  const waiters: Array<(value: GlobalEventEnvelope | undefined) => void> = []
  const state = { closed: false }

  const close = () => {
    state.closed = true
    for (const waiter of waiters.splice(0)) {
      waiter(undefined)
    }
  }

  const stream = async function* (signal?: AbortSignal) {
    while (true) {
      if (signal?.aborted) return
      const next = queue.shift()
      if (next) {
        yield next
        continue
      }
      if (state.closed) return
      const value = await new Promise<GlobalEventEnvelope | undefined>((resolve) => {
        waiters.push(resolve)
        if (!signal) return
        signal.addEventListener("abort", () => resolve(undefined), { once: true })
      })
      if (!value) return
      yield value
    }
  }

  return { controller: { close } satisfies EventController, stream }
}

function createFakeAgent() {
  const sessionUpdates: SessionUpdateParams[] = []
  const summarize: Record<string, unknown>[] = []
  let created = 0
  const { controller, stream } = createEventStream()

  const connection = {
    async sessionUpdate(params: SessionUpdateParams) {
      sessionUpdates.push(params)
    },
    async requestPermission(_params: RequestPermissionParams): Promise<RequestPermissionResult> {
      return { outcome: { outcome: "selected", optionId: "once" } } as RequestPermissionResult
    },
  } as unknown as AgentSideConnection

  const sdk = {
    global: {
      event: async (opts?: { signal?: AbortSignal }) => ({
        stream: stream(opts?.signal),
      }),
    },
    session: {
      create: async () => ({
        data: {
          id: `ses_${++created}`,
          time: { created: new Date().toISOString() },
        },
      }),
      messages: async () => ({ data: [] }),
      summarize: async (params: Record<string, unknown>) => {
        summarize.push(params)
        return { data: true }
      },
    },
    config: {
      providers: async () => ({
        data: {
          providers: [
            {
              id: "opencode",
              name: "opencode",
              models: {
                "big-pickle": {
                  id: "big-pickle",
                  name: "big-pickle",
                },
              },
            },
          ],
        },
      }),
    },
    app: {
      agents: async () => ({
        data: [
          {
            name: "code",
            description: "code",
            mode: "agent",
          },
        ],
      }),
    },
    command: {
      list: async () => ({ data: [] }),
    },
    mcp: {
      add: async () => ({ data: true }),
    },
  } as any

  const agent = new ACP.Agent(connection, {
    sdk,
    defaultModel: { providerID: "opencode", modelID: "big-pickle" },
  } as any)

  const stop = () => {
    controller.close()
    ;(agent as any).eventAbort.abort()
  }

  return { agent, sessionUpdates, summarize, stop }
}

describe("acp.agent prompt commands", () => {
  test("announces compact-all as an available command", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const ctx = createFakeAgent()
        try {
          const sessionId = await ctx.agent.newSession({ cwd: tmp.path, mcpServers: [] } as any).then((x) => x.sessionId)

          await new Promise((resolve) => setTimeout(resolve, 10))

          const update = ctx.sessionUpdates.find(
            (item) => item.sessionId === sessionId && item.update.sessionUpdate === "available_commands_update",
          )

          expect(update).toBeTruthy()
          if (!update || update.update.sessionUpdate !== "available_commands_update") return

          expect(update.update.availableCommands.some((item) => item.name === "compact-all")).toBe(true)
        } finally {
          ctx.stop()
        }
      },
    })
  })

  test("routes /compact-all to summarize with zero tail turns", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const ctx = createFakeAgent()
        try {
          const sessionId = await ctx.agent.newSession({ cwd: tmp.path, mcpServers: [] } as any).then((x) => x.sessionId)

          await ctx.agent.prompt({
            sessionId,
            prompt: [{ type: "text", text: "/compact-all" }],
          } as any)

          expect(ctx.summarize).toHaveLength(1)
          expect(ctx.summarize[0]).toEqual({
            sessionID: sessionId,
            directory: tmp.path,
            providerID: "opencode",
            modelID: "big-pickle",
            tailTurns: 0,
          })
        } finally {
          ctx.stop()
        }
      },
    })
  })
})