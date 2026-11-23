/** Parse optional Ping history after the viewport scheduler begins an idle request. */
import { isObj as record, num } from "./api"

type Bucket = { latency: number | null; loss: number | null }
type Probe = { name: string; latency: number | null; loss: number | null }
export type PingSummary = Omit<Probe, "name"> & { probes: Probe[]; buckets: Bucket[] }
const number = (v: unknown): v is number => num(v) && v >= 0
const mean = (sum: number, count: number, digits: number) => count ? Number((sum / count).toFixed(digits)) : null

export function summarizePing(resp: unknown): PingSummary | undefined {
  if (!record(resp) || !Array.isArray(resp.ping)) return undefined
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
  if (!groups.size) return undefined
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
