import { isObj as record, num } from "./api"
import { SvelteMap } from "svelte/reactivity"

type Bucket = { latency: number | null; loss: number | null }
type Probe = { name: string; latency: number | null; loss: number | null }
export type PingSummary = Omit<Probe, "name"> & { probes: Probe[]; buckets: Bucket[] }
const empty: PingSummary = { latency: null, loss: null, probes: [], buckets: [] }
const number = (v: unknown): v is number => num(v) && v >= 0
const mean = (values: number[], digits: number) => values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(digits)) : null

export function summarizePing(resp: unknown, latestLoss = false): PingSummary {
  if (!record(resp) || !Array.isArray(resp.ping)) return empty
  const names = record(resp.probes) ? resp.probes : {}
  const lossMap = record(resp.loss) ? resp.loss : null
  const groups = new Map<string, { latency: number | null; ts: number; lossTS:number; lastLoss:number|null; losses: number[] }>()
  const times = new Map<number,{lat:number[]; lost:number[]}>()
  for (const point of resp.ping) {
    if (!record(point) || !(number(point.task_id) || typeof point.task_id === "string")) continue
    const id = String(point.task_id)
    const g = groups.get(id) ?? { latency: null, ts: -Infinity, lossTS:-Infinity, lastLoss:null, losses: [] }
    const ts = number(point.ts) ? point.ts : g.ts
    if (number(point.latency) && ts >= g.ts) { g.latency = point.latency; g.ts = ts }
    // The Hub omits a zero-loss bucket / probe from its loss fields.
    if (number(point.loss) || point.loss === undefined) g.losses.push(number(point.loss) ? point.loss : 0)
    if (ts >= g.lossTS) { g.lossTS=ts; g.lastLoss=number(point.loss)?point.loss:point.loss===undefined?0:null }
    if (number(point.ts)) {
      const bin=times.get(ts) ?? {lat:[], lost:[]}
      if(number(point.latency)) bin.lat.push(point.latency)
      if(number(point.loss) || point.loss===undefined) bin.lost.push(number(point.loss) ? point.loss : 0)
      times.set(ts,bin)
    }
    groups.set(id, g)
  }
  if (!groups.size) return empty
  const probes = Array.from(groups, ([id, g]) => {
    const loss = lossMap?.[id]
    return { name: typeof names[id] === "string" ? names[id] : `探测 #${id}`, latency: g.latency,
      loss: latestLoss ? g.lastLoss : lossMap ? (number(loss) ? Number(loss.toFixed(1)) : loss === undefined ? 0 : null) : mean(g.losses, 1) }
  })
  const buckets=Array.from(times).sort(([a],[b])=>a-b).slice(-12).map(([,b])=>({latency:mean(b.lat,0),loss:mean(b.lost,1)}))
  return { probes, buckets, latency: mean(probes.map(p => p.latency).filter(number), 0),
    loss: lossMap && !Object.keys(lossMap).length ? 0 : mean(lossMap ? Object.values(lossMap).filter(number) : Array.from(groups.values()).flatMap(g => g.losses), 1) }
}

// Undefined means no completed request; null is a completed sample without a value.
export const latencyText = (n: number | null | undefined) => n === undefined ? "…" : n === null ? "—" : `${n} ms`
export const lossText = (n: number | null | undefined) => n === undefined ? "…" : n === null ? "—" : `${Number(n.toFixed(1))}%`
export const latencyColor = (n: number | null | undefined) => n == null ? 'text-neutral-500' : n < 100 ? 'text-emerald-700' : n <= 200 ? 'text-amber-700' : 'text-red-700'
export const lossColor = (n: number | null | undefined) => n == null || n === 0 ? 'text-neutral-500' : n <= 5 ? 'text-amber-700' : 'text-red-700'
export const probeTitle = (s?: PingSummary) => s ? s.probes.map(p => `${p.name}：${latencyText(p.latency)} · ${lossText(p.loss)}`).join("\n") : "等待探测数据"

/** One scheduler per app. Card and row subscriptions share results, cooldowns and capacity. */
export function createPingStore() {
  const results = new SvelteMap<number, PingSummary>()
  const next = new Map<number, number>()
  const flight = new Map<number, AbortController>()
  const targets = new Map<Element, number>()
  const visible = new Set<Element>()
  let observer: IntersectionObserver | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancelIdle: (() => void) | undefined
  let disposed = false, scrolling = false
  let settled: ReturnType<typeof setTimeout>
  function onScroll() { scrolling=true; clearTimeout(settled); clearTimeout(timer); cancelIdle?.(); cancelIdle=undefined
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
        if (record(body) && Array.isArray(body.ping) && !body.ping.length) delay = 600_000
        value = summarizePing(body,true)
      }
    } catch { /* A timeout or unsuccessful read clears the previous sample. */ }
    finally {
      clearTimeout(timeout)
      if (!disposed && (!ctrl.signal.aborted || timedOut)) { results.set(id, value); next.set(id, Date.now() + delay) }
      flight.delete(id)
      schedule()
    }
  }

  const visibleIds = () => new Set(Array.from(visible, el => targets.get(el)).filter((id): id is number => !!id))
  function stopTimers() { clearTimeout(timer); cancelIdle?.(); cancelIdle = undefined }
  function schedule() {
    clearTimeout(timer)
    if (disposed) return
    const ids = document.hidden ? new Set<number>() : visibleIds()
    for (const [id, ctrl] of flight) if (!ids.has(id)) ctrl.abort()
    if (scrolling || !ids.size || flight.size >= 3) { stopTimers(); return }
    const due = Math.min(...Array.from(ids, id => flight.has(id) ? Infinity : next.get(id) ?? 0))
    if (!Number.isFinite(due)) return
    if (due > Date.now()) { timer = setTimeout(schedule, due - Date.now()); return }
    if (cancelIdle) return
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
  function destroy() {
    clearTimeout(settled); window.removeEventListener("scroll",onScroll,true)
    disposed = true; stopTimers(); observer?.disconnect(); document.removeEventListener("visibilitychange", schedule)
    for (const ctrl of flight.values()) ctrl.abort()
    targets.clear(); visible.clear()
  }
  return { observe, get: (id: number) => results.get(id), destroy }
}
export type PingStore = ReturnType<typeof createPingStore>
