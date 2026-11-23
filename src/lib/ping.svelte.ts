import { isObj as record } from "./api"
import type { PingSummary } from "./ping-summary"
export type { PingSummary } from "./ping-summary"

const empty: PingSummary = { latency: null, loss: null, probes: [], buckets: [] }
let parser: Promise<typeof import("./ping-summary")> | undefined
const loadParser = () => parser ??= import("./ping-summary")
// In dev, load the parser with the scheduler. In production it stays out of
// the entry and is requested only for optional Ping work after mounting.
if (import.meta.env.DEV) await loadParser()

// Undefined means no completed request; null is a completed sample without a value.
export const latencyText = (n: number | null | undefined) => n === undefined ? "…" : n === null ? "—" : `${n} ms`
export const lossText = (n: number | null | undefined) => n === undefined ? "…" : n === null ? "—" : `${Number(n.toFixed(1))}%`
export const probeTitle = (s?: PingSummary) => s ? s.probes.map(p => `${p.name}：${latencyText(p.latency)} · ${lossText(p.loss)}`).join("\n") : "等待探测数据"

function resultCell() {
  let value = $state.raw<PingSummary>()
  return { get value() { return value }, set value(next) { value = next } }
}

/** One scheduler per app. Card and row subscriptions share results, cooldowns and capacity. */
export function createPingStore() {
  const results = new Map<number, ReturnType<typeof resultCell>>()
  let published = $state(0)
  function peek(id: number): PingSummary | undefined {
    // A missing cache entry subscribes to publications without installing a cell.
    const cell = results.get(id)
    if (cell) return cell.value
    void published
    return undefined
  }
  function result(id: number) {
    let cell = results.get(id)
    if (!cell) results.set(id, cell = resultCell())
    return cell
  }
  const next = new Map<number, number>()
  const flight = new Map<number, AbortController>()
  const targets = new Map<Element, number>()
  const visible = new Set<Element>()
  let observer: IntersectionObserver | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancelIdle: (() => void) | undefined
  let disposed = false, scrolling = false
  let settled: ReturnType<typeof setTimeout>
  function onScroll() { scrolling=true; clearTimeout(settled); stopTimers()
    settled=setTimeout(()=>{scrolling=false; schedule()},300) }

  async function sample(id: number) {
    const ctrl = new AbortController()
    flight.set(id, ctrl)
    let timedOut = false, delay = 60_000
    const timeout = setTimeout(() => { timedOut = true; ctrl.abort() }, 8_000)
    let value = empty
    try {
      const res = await fetch(`/api/nodes/${id}/metrics?hours=1&points=12&series=ping`, { signal: ctrl.signal })
      if (res.status === 404) delay = 600_000
      if (res.ok) {
        const body: unknown = await res.json()
        if (record(body) && Array.isArray(body.ping)) {
          if (body.ping.length) {
            const { summarizePing } = await loadParser()
            value = summarizePing(body) ?? empty
          } else delay = 600_000
        }
      }
    } catch { /* A timeout or unsuccessful read clears the previous sample. */ }
    finally {
      clearTimeout(timeout)
      if (flight.get(id) === ctrl) {
        flight.delete(id)
        if (!disposed && (!ctrl.signal.aborted || timedOut)) {
          result(id).value = value
          published++
          next.set(id, Date.now() + delay)
        }
      }
      schedule()
    }
  }

  function visibleIds() {
    const ids = new Set<number>()
    for (const el of visible) {
      const id = targets.get(el)
      if (id) ids.add(id)
    }
    return ids
  }
  function stopTimers() { clearTimeout(timer); cancelIdle?.(); cancelIdle = undefined }
  function schedule() {
    clearTimeout(timer)
    if (disposed) return
    const ids = document.hidden ? new Set<number>() : visibleIds()
    for (const [id, ctrl] of flight) if (!ids.has(id)) ctrl.abort()
    if (scrolling || !ids.size || flight.size >= 3) { stopTimers(); return }
    let due = Infinity
    for (const id of ids) if (!flight.has(id)) due = Math.min(due, next.get(id) ?? 0)
    if (!Number.isFinite(due)) return
    if (due > Date.now()) { timer = setTimeout(schedule, due - Date.now()); return }
    if (cancelIdle) return
    if (!import.meta.env.DEV) void loadParser().catch(() => {})
    const drain = () => {
      cancelIdle = undefined
      if (document.hidden || disposed || scrolling) return
      for (const id of visibleIds()) {
        if (flight.size >= 3) break
        if (!flight.has(id) && (next.get(id) ?? 0) <= Date.now()) void sample(id)
      }
    }
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(drain); cancelIdle = () => window.cancelIdleCallback(handle)
    } else {
      const handle = setTimeout(drain, 1500); cancelIdle = () => clearTimeout(handle)
    }
  }

  function observe(el: Element, id: number) {
    function update(value: number) {
      if (value && !observer) {
        observer = new IntersectionObserver(entries => {
          for (const e of entries) if (targets.has(e.target)) {
            if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target)
          }
          schedule()
        }, { rootMargin: "200px" })
        document.addEventListener("visibilitychange", schedule)
        window.addEventListener("scroll", onScroll, {capture:true, passive:true})
      }
      if (value) { targets.set(el, value); observer?.observe(el) }
      else { targets.delete(el); visible.delete(el); observer?.unobserve(el) }
      schedule()
    }
    update(id)
    return { update, destroy: () => update(0) }
  }
  function forget(id: number) {
    const ctrl = flight.get(id)
    flight.delete(id); ctrl?.abort()
    const cell = results.get(id)
    if (cell) cell.value = undefined
    results.delete(id); next.delete(id)
  }
  function destroy() {
    clearTimeout(settled); window.removeEventListener("scroll",onScroll,true)
    disposed = true; stopTimers(); observer?.disconnect(); document.removeEventListener("visibilitychange", schedule)
    for (const ctrl of flight.values()) ctrl.abort()
    targets.clear(); visible.clear(); flight.clear(); next.clear(); results.clear()
  }
  return { observe, get: (id: number) => result(id).value, peek, forget, destroy }
}
export type PingStore = ReturnType<typeof createPingStore>
