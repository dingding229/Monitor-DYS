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
  return { id: raw.id, ...Object.fromEntries(strings.map(k => [k, typeof raw[k] === 'string' ? raw[k] : ''])),
    ...Object.fromEntries(numbers.map(k => [k, Number.isFinite(raw[k]) ? raw[k] : null])), metrics }
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
        const list = nodes.map(project)
        if (list.every(Boolean) && new Set(list.map(n => n!.id)).size === list.length) {
          // Snapshot is a display seed only. The first HTTP read supplies live status and full metadata.
          return safeNodes(list.map((n, sort) => ({ ...n, sort, online: n!.metrics !== null })) as Node[])
        }
      }
    }
  } catch { /* discard corrupt / inaccessible storage */ }
  clearSnapshot(); return null
}
