/**
 * ContextProgress — visible context usage summary in the task header.
 *
 * When per-section breakdown is available, render compact horizontal pills for
 * each section plus the total usage summary. Otherwise fall back to the legacy
 * progress bar so older sessions still show something useful.
 */

import { Component, createMemo, For, JSX, Show } from "solid-js"
import { Tooltip } from "@kilocode/kilo-ui/tooltip"
import { useSession } from "../../context/session"
import { useProvider } from "../../context/provider"

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/** One label → value row in the breakdown tooltip */
function Row(props: { label: string; value: string; dim?: boolean }): JSX.Element {
  return (
    <div style={{ display: "flex", "justify-content": "space-between", gap: "16px", opacity: props.dim ? "0.6" : "1" }}>
      <span>{props.label}</span>
      <span style={{ "font-variant-numeric": "tabular-nums" }}>{props.value}</span>
    </div>
  )
}

export const ContextProgress: Component = () => {
  const session = useSession()
  const provider = useProvider()

  const data = createMemo(() => {
    const usage = session.contextUsage()
    if (!usage || usage.tokens === 0) return undefined

    const sel = session.selected()
    const model = sel ? provider.findModel(sel) : undefined
    const limit = model?.limit?.context ?? model?.contextLength ?? 0
    const output = model?.limit?.output ?? 0

    if (limit === 0) return undefined

    const used = Math.min(usage.tokens, limit)
    const reserved = Math.min(output, limit - used)
    const available = Math.max(0, limit - used - reserved)

    const pctUsed = (used / limit) * 100
    const pctReserved = (reserved / limit) * 100
    const pctAvail = (available / limit) * 100

    return { used, reserved, available, limit, pctUsed, pctReserved, pctAvail, output }
  })

  const items = createMemo(() => {
    const bd = session.contextUsage()?.breakdown
    if (!bd) return []
    return [
      { key: "system", label: "System", short: "System", value: bd.system },
      { key: "tools", label: "Tools", short: "Tools", value: bd.tools },
      { key: "instructions", label: "Instructions", short: "Instr", value: bd.instructions },
      { key: "files", label: "Context files", short: "Files", value: bd.context_files },
      { key: "messages", label: "Messages", short: "Msgs", value: bd.messages },
    ].filter((item) => item.value > 0)
  })

  const tip = createMemo((): JSX.Element => {
    const d = data()
    if (!d) return ""
    if (items().length > 0) {
      return (
        <div style={{ "min-width": "160px" }}>
          <For each={items()}>{(item) => <Row label={item.label} value={fmt(item.value)} />}</For>
          <div style={{ "border-top": "1px solid currentColor", opacity: "0.2", margin: "4px 0" }} />
          <Row label="Total" value={`${fmt(d.used)} / ${fmt(d.limit)}`} />
          <Show when={d.output > 0}>
            <Row label="Reserved" value={fmt(d.output)} dim />
          </Show>
          <Show when={d.available > 0}>
            <Row label="Available" value={fmt(d.available)} dim />
          </Show>
        </div>
      )
    }
    const lines = [`${fmt(d.used)} / ${fmt(d.limit)} tokens used`]
    if (d.output > 0) lines.push(`${fmt(d.output)} reserved for output`)
    if (d.available > 0) lines.push(`${fmt(d.available)} available`)
    return lines.join("\n")
  })

  return (
    <Show when={data()}>
      {(d) => (
        <div class="context-progress">
          <Show
            when={items().length > 0}
            fallback={
              <>
                <span class="context-progress-count">{fmt(d().used)}</span>
                <Tooltip value={tip()} placement="top">
                  <div class="context-progress-bar">
                    <div
                      class="context-progress-used"
                      classList={{ "context-progress-used--hot": d().pctUsed >= 50 }}
                      style={{ width: `${d().pctUsed}%` }}
                    />
                    <div class="context-progress-reserved" style={{ width: `${d().pctReserved}%` }} />
                    <Show when={d().pctAvail > 0}>
                      <div class="context-progress-available" style={{ width: `${d().pctAvail}%` }} />
                    </Show>
                  </div>
                </Tooltip>
                <span class="context-progress-count">{fmt(d().limit)}</span>
              </>
            }
          >
            <Tooltip value={tip()} placement="top">
              <div class="context-progress-breakdown">
                <For each={items()}>
                  {(item) => (
                    <span class={`context-progress-section context-progress-section--${item.key}`}>
                      <span class="context-progress-section-label">{item.short}</span>
                      <span class="context-progress-section-value">{fmt(item.value)}</span>
                    </span>
                  )}
                </For>
              </div>
            </Tooltip>
            <span class="context-progress-summary">{fmt(d().used)} / {fmt(d().limit)}</span>
          </Show>
        </div>
      )}
    </Show>
  )
}
