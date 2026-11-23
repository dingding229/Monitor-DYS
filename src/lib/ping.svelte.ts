import { isObj as record, num } from "./api"

type Bucket = { latency: number | null; loss: number | null }
type Probe = { name: string; latency: number | null; loss: number | null }
export type PingSummary = Omit<Probe, "name"> & { probes: Probe[]; buckets: Bucket[] }
const empty: PingSummary = { latency: null, loss: null, probes: [], buckets: [] }
const number = (v: unknown): v is number => num(v) && v >= 0
const mean = (sum: number, count: number, digits: number) => count ? Number((sum / count).toFixed(digits)) : null

function summarizePing(resp: unknown): PingSummary {
  if (!record(resp) || !Array.isArray(resp.ping)) return empty
  const names = record(resp.probes) ? resp.probes : {}
  const lossFields = record(resp.loss) ? Object.values(resp.loss) : null
  const groups = new Map<string, { latency: number | null; ts: number; lossTS: number; loss: number | null }>()
  const times = new Map<number, { lat: number; count: number; lost: number; samples: number }>()
  let lost = 0, samples = 0, latency = 0, count = 0
  for (const point of resp.ping) {
    if (!record(point) || !(number(point.task_id) || typeof point.task_id === "string")) continue
    const id = String(point.task_id)
    const group = groups.get(id) ?? { latency: null, ts: -Infinity, lossTS: -Infinity, loss: null }
    const timestamp = number(point.ts) ? point.ts : null
    const ts = timestamp ?? group.ts
    const lat = number(point.latency) ? point.latency : null
    // Older Hubs omit zero-loss buckets, but an explicit null is unknown.
    const loss = point.loss === undefined ? 0 : number(point.loss) ? point.loss : null
    if (lat !== null && ts >= group.ts) { group.latency = lat; group.ts = ts }
    if (ts >= group.lossTS) { group.lossTS = ts; group.loss = loss }
    groups.set(id, group)
    if (!lossFields && loss !== null) { lost += loss; samples++ }
    if (timestamp !== null) {
      const bin = times.get(ts) ?? { lat: 0, count: 0, lost: 0, samples: 0 }
      if (lat !== null) { bin.lat += lat; bin.count++ }
      if (loss !== null) { bin.lost += loss; bin.samples++ }
      times.set(ts, bin)
    }
  }
  if (!groups.size) return empty
  for (const loss of lossFields ?? []) if (number(loss)) { lost += loss; samples++ }
  const probes = Array.from(groups, ([id, { latency: lat, loss }]) => {
    if (lat !== null) { latency += lat; count++ }
    return { name: typeof names[id] === "string" ? names[id] : `探测 #${id}`, latency: lat, loss }
  })
  const buckets = [...times].sort(([a], [b]) => a - b).slice(-12).map(([, bin]) => ({
    latency: mean(bin.lat, bin.count, 0), loss: mean(bin.lost, bin.samples, 1),
  }))
  return { probes, buckets, latency: mean(latency, count, 0), loss: lossFields?.length === 0 ? 0 : mean(lost, samples, 1) }
}

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
        value = summarizePing(body)
      }
    } catch { /* A timeout or unsuccessful read clears the previous sample. */ }
    finally {
      clearTimeout(timeout)
      if (flight.get(id) === ctrl) {
        flight.delete(id)
        if (!disposed && (!ctrl.signal.aborted || timedOut)) { result(id).value = value; next.set(id, Date.now() + delay) }
      }
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
  return { observe, get: (id: number) => result(id).value, forget, destroy }
}
export type PingStore = ReturnType<typeof createPingStore>
