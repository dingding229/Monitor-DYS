import { isObj, metricFields, num, safeNodes, type Node, type Metrics } from "./api"

const KEY = "dys:snap:v1", LIMIT = 200_000, TTL = 24 * 60 * 60 * 1000
const strings = ['name','country','os','group','currency','billing_cycle','traffic_mode'] as const
const numbers = ['price','expires_in','traffic_limit','traffic_reset_day'] as const

// Project both reads and writes: never persist private/admin metadata or arbitrary metrics keys.
function project(raw: unknown) {
  if (!isObj(raw) || raw.public === false || typeof raw.id !== 'number' || !Number.isSafeInteger(raw.id) || typeof raw.name !== 'string') return null
  const m = raw.metrics
  let metrics: Partial<Metrics> | null = null
  if (isObj(m) && Array.isArray(m.load) && m.load.length === 3 && m.load.every(Number.isFinite)) {
    metrics = { load: [m.load[0], m.load[1], m.load[2]] }
    for (const key of metricFields) if (num(m[key])) metrics[key] = m[key]
  }
  const node: { id: number; metrics: Partial<Metrics> | null; [key: string]: unknown } = { id: raw.id, metrics }
  for (const key of strings) node[key] = typeof raw[key] === "string" ? raw[key] : ""
  for (const key of numbers) node[key] = num(raw[key]) ? raw[key] : null
  return node
}
const fits = (data: string) => data.length <= LIMIT && new TextEncoder().encode(data).byteLength <= LIMIT

export function clearSnapshot() { try { localStorage.removeItem(KEY) } catch { /* storage unavailable */ } }
export function saveSnapshot(nodes: Node[]) {
  try {
    const data = JSON.stringify({ ts: Date.now(), nodes: (nodes.length>500 ? nodes.slice(0,120) : nodes).map(project).filter(Boolean) })
    if (fits(data)) localStorage.setItem(KEY, data)
    else clearSnapshot()
  } catch { /* quota/private browsing must not interrupt live updates */ }
}
export function readSnapshot(): Node[] | null {
  try {
    const data = localStorage.getItem(KEY)
    if (!data) return null
    if (fits(data)) {
      const { ts, nodes } = JSON.parse(data)
      const age = Date.now() - ts
      if (typeof ts === 'number' && age >= 0 && age < TTL && Array.isArray(nodes)) {
        const seen = new Set<number>(), list = []
        for (const raw of nodes) {
          const n = project(raw)
          if (!n || seen.has(n.id)) break
          seen.add(n.id)
          list.push({ ...n, sort: list.length, online: n.metrics !== null })
        }
        // Snapshot is a display seed only; the first HTTP read supplies live data.
        if (list.length === nodes.length) return safeNodes(list as Node[])
      }
    }
  } catch { /* discard corrupt / inaccessible storage */ }
  clearSnapshot(); return null
}
