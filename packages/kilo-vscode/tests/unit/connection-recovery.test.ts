import { describe, expect, it } from "bun:test"
import type * as vscode from "vscode"
import { KiloConnectionService } from "../../src/services/cli-backend/connection-service"
import { ServerManager, type ServerInstance } from "../../src/services/cli-backend/server-manager"

function ctx() {
  return {
    extensionPath: "/tmp/kilo-ext",
    globalStorageUri: { fsPath: "/tmp/kilo-store" },
    extension: { packageJSON: { version: "test" } },
  } as unknown as vscode.ExtensionContext
}

describe("ServerManager", () => {
  it("starts a new server when the cached process is stale", async () => {
    const mgr = new ServerManager(ctx())
    const old = {
      port: 1,
      password: "old",
      process: { pid: 111, exitCode: 1, signalCode: null } as any,
    } satisfies ServerInstance
    const next = {
      port: 2,
      password: "next",
      process: { pid: 222, exitCode: null, signalCode: null } as any,
    } satisfies ServerInstance

    ;(mgr as any).instance = old
    let calls = 0
    ;(mgr as any).startServer = async () => {
      calls += 1
      return next
    }

    const got = await mgr.getServer()

    expect(got).toBe(next)
    expect(calls).toBe(1)
  })
})

describe("KiloConnectionService", () => {
  it("revives the backend with the last workspace dir", async () => {
    const svc = new KiloConnectionService(ctx()) as any
    const seen: string[] = []

    svc.dir = "/repo"
    svc.client = { name: "client" }
    svc.sseClient = {
      dispose: () => seen.push("sse"),
    }
    svc.info = { port: 1 }
    svc.config = { baseUrl: "http://127.0.0.1:1", password: "pw" }
    svc.serverManager = {
      dispose: () => seen.push("server"),
    }
    svc.setState = (state: string) => seen.push(`state:${state}`)
    svc.connect = async (dir: string) => {
      seen.push(`connect:${dir}`)
    }

    svc.revive("test")
    await svc.revivePromise

    expect(seen).toEqual(["sse", "server", "state:disconnected", "connect:/repo"])
    expect(svc.client).toBeNull()
    expect(svc.sseClient).toBeNull()
    expect(svc.info).toBeNull()
    expect(svc.config).toBeNull()
  })
})