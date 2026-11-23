/**
 * Derived in part from monitor-theme-default (MIT, Copyright (c) 2026 stqfdyr).
 */

export const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v)
export const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

export type Metrics = {
  uptime: number
  cpu: number
  load: [number, number, number]
  mem_total: number
  mem_used: number
  swap_total?: number
  swap_used?: number
  disk_total: number
  disk_used: number
  net_rx: number
  net_tx: number
  total_rx: number
  total_tx: number
  month_rx: number
  month_tx: number
  tcp?: number
  udp?: number
  procs?: number
}

export type Node = {
  id: number
  name: string
  sort: number
  public?: boolean
  online: boolean
  /** ISO 3166-1 alpha-2, or empty when the hub could not locate the address. */
  country: string
  /** Set by the operator; empty is ungrouped. Absent from a hub predating groups. */
  group?: string
  /** Public remark shown to visitors. Absent on older hubs. */
  public_remark?: string
  last_seen: number
  /** Seconds since `last_seen` on the hub's clock, null for a node never seen. Absent on older hubs. */
  last_seen_ago?: number | null
  metrics: Metrics | null
  /** Marked true by safeNodes when a report carries malformed metrics so the UI can distinguish '不可用' from '等待数据'. */
  _corrupt?: boolean
  os: string
  kernel: string
  arch: string
  virt: string
  cpu_name: string
  cpu_cores: number
  mem_total: number
  swap_total?: number
  disk_total: number
  agent_version: string
  price: number
  currency: string
  billing_cycle: string
  expires_at: string | null
  /** Days until `expires_at` on the hub's calendar, negative once past, null without a date. Absent on older hubs. */
  expires_in?: number | null
  traffic_limit: number
  traffic_mode: string
  traffic_reset_day: number
  total_rx: number
  total_tx: number
  month_rx: number
  month_tx: number
  /** This period's usage as the plan meters it (`traffic_mode`). Absent on older hubs. */
  month_used?: number
  month_start: string
  day_rx: number
  day_tx: number
  /** Panel only. */
  hostname?: string
  ip?: string
  remark?: string
}

export type Me = {
  authed: boolean
  github?: boolean
  site_name: string
  public_page: boolean
  history_days?: number
}

export const ALL_GROUP: unique symbol = Symbol("ALL_GROUP")
export const UNGROUPED: unique symbol = Symbol("UNGROUPED")
export type GroupKey = typeof ALL_GROUP | typeof UNGROUPED | string

/** Every group in use, in the order of the first node carrying it. */
export function groupsOf(nodes: Pick<Node, "group">[]): string[] {
  if (!Array.isArray(nodes)) return []
  return [...new Set(nodes.map((n) => (typeof n?.group === "string" ? n.group : "")).filter(Boolean))]
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function failure(res: Response): Promise<ApiError> {
  const ct = res.headers?.get?.("content-type") ?? ""
  const text = ct.startsWith("text/plain") ? (await res.text()).trim() : ""
  return new ApiError(
    res.status,
    text ||
      (res.status === 401
        ? "需要登录后查看"
        : res.status >= 500
          ? `服务暂时无法访问（HTTP ${res.status}），稍后再试`
          : `请求被拦截（HTTP ${res.status}），稍后再试`),
  )
}

const TIMEOUT = 20_000
const RETRIES = 6

export async function api<T>(
  path: string,
  opts?: { fetch?: typeof globalThis.fetch; timeoutMs?: number; retries?: number },
): Promise<T> {
  const fetchFn = opts?.fetch ?? globalThis.fetch
  const timeoutMs = opts?.timeoutMs ?? TIMEOUT
  const maxRetries = opts?.retries ?? RETRIES
  const url = path.startsWith("/api/") || path === "/api" ? path : `/api${path.startsWith("/") ? path : `/${path}`}`

  for (let attempt = 0; ; attempt++) {
    try {
      const signal = typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(timeoutMs) : undefined
      const res = await fetchFn(url, signal ? { signal } : undefined)
      if (!res.ok) throw await failure(res)
      return (await res.json().catch((e: unknown) => {
        throw e instanceof SyntaxError ? new ApiError(res.status, "收到的不是状态数据，稍后再试") : e
      })) as T
    } catch (e) {
      if (e instanceof ApiError) throw e
      const namedError = e instanceof Error || (typeof DOMException !== "undefined" && e instanceof DOMException)
      const timedOut = namedError && (e.name === "TimeoutError" || e.name === "AbortError")
      if (!timedOut || attempt >= maxRetries) {
        throw new ApiError(0, "网络连接失败，稍后再试")
      }
    }
  }
}

const isNonNegNum = (v: unknown): v is number => num(v) && v >= 0
const isOptNonNegNum = (v: unknown): boolean => v === undefined || v === null || isNonNegNum(v)
const requiredFields = ["uptime","cpu","mem_total","mem_used","disk_total","disk_used","net_rx","net_tx","total_rx","total_tx","month_rx","month_tx"] as const
const optionalFields = ["swap_total", "swap_used", "tcp", "udp", "procs"] as const

/**
 * Validate node metrics so a malformed report does not crash the whole page.
 * Per SPEC §5.1 & §5.15: swap_total, swap_used, tcp, udp, procs may be absent on older hubs.
 */
export function safeNodes(nodes: Node[]): Node[] {
  if (!Array.isArray(nodes)) return []

  return nodes.map((node) => {
    const m = node.metrics
    if (m === null) return node
    const valid =
      typeof m === "object" &&
      m !== null &&
      requiredFields.every((key) => isNonNegNum(m[key])) &&
      optionalFields.every((key) => isOptNonNegNum(m[key])) &&
      Array.isArray(m.load) &&
      m.load.length === 3 &&
      m.load.every(isNonNegNum)

    return valid ? node : { ...node, metrics: null, _corrupt: true }
  })
}

const KEEP = 60
export const speedHistory = new Map<GroupKey, { rx: number; tx: number }[]>()

export function sample(nodes: Node[]) {
  const totals = new Map<GroupKey, { rx: number; tx: number }>()
  totals.set(ALL_GROUP, { rx: 0, tx: 0 })
  for (const n of nodes) {
    const gKey: GroupKey = n.group ? n.group : UNGROUPED
    const keys: GroupKey[] = [ALL_GROUP, gKey]
    for (const key of keys) {
      const total = totals.get(key) ?? { rx: 0, tx: 0 }
      if (n.online && n.metrics) {
        total.rx += n.metrics.net_rx
        total.tx += n.metrics.net_tx
      }
      totals.set(key, total)
    }
  }
  for (const key of speedHistory.keys()) {
    if (!totals.has(key)) speedHistory.delete(key)
  }
  for (const [key, total] of totals) {
    const series = speedHistory.get(key) ?? []
    series.push(total)
    if (series.length > KEEP) series.shift()
    speedHistory.set(key, series)
  }
}
