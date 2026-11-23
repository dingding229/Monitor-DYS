/** Eager home directory and summary; the map-specific aggregation stays lazy. */
import { num, type GroupKey, type Node } from "./api"
import { percentNum } from "./format-common"
import { directory, type SortKey } from "./view-state"

export type HomeFilters = {
  group: GroupKey
  country: string | null
  query: string
  sort: SortKey
}

export type ReadPing = (id: number) => { latency: number | null; loss: number | null } | undefined
export type NodeStatus = "online" | "warn" | "offline"
type PeakCpu = { id: number; name: string; value: number }
export const noPing: ReadPing = () => undefined

export function hasWarning(node: Node, ping?: ReturnType<ReadPing>): boolean {
  const m = node.metrics
  return Boolean(m && (m.cpu >= 90 || percentNum(m.mem_used, m.mem_total || node.mem_total) >= 90 ||
    percentNum(m.disk_used, m.disk_total || node.disk_total) >= 90)) ||
    (num(ping?.loss) && ping.loss >= 5) || (num(ping?.latency) && ping.latency >= 200)
}

export function summarizeNodes(nodes: readonly Node[], readPing: ReadPing = noPing, expiryWarningDays = 7) {
  const totals = {
    total: nodes.length, online: 0, offline: 0, warn: 0, expired: 0, expiring: 0, uptimeRatio: 0,
    cores: null as number | null, peakCpu: null as PeakCpu | null, statusStrip: [] as NodeStatus[],
    countries: new Set<string>(), tx: 0, rx: 0, month_tx: 0, month_rx: 0, total_tx: 0, total_rx: 0,
    day_tx: null as number | null, day_rx: null as number | null,
  }
  for (const node of nodes) {
    const code = node.country?.trim().toUpperCase()
    if (code) totals.countries.add(code)
    if (node.online) {
      totals.online++
      totals.tx += node.metrics?.net_tx ?? 0
      totals.rx += node.metrics?.net_rx ?? 0
      const warn = hasWarning(node, readPing(node.id))
      if (warn) totals.warn++
      totals.statusStrip.push(warn ? "warn" : "online")
      if (num(node.cpu_cores) && node.cpu_cores >= 0) totals.cores = (totals.cores ?? 0) + node.cpu_cores
      const cpu = node.metrics?.cpu
      if (num(cpu) && (!totals.peakCpu || cpu > totals.peakCpu.value)) {
        totals.peakCpu = { id: node.id, name: node.name, value: cpu }
      }
    } else {
      totals.statusStrip.push("offline")
    }
    if (num(node.expires_in)) {
      if (node.expires_in <= 0) totals.expired++
      else if (node.expires_in <= expiryWarningDays) totals.expiring++
    }
    for (const key of ["month_tx", "month_rx", "total_tx", "total_rx"] as const) {
      const value = node[key] ?? node.metrics?.[key]
      if (num(value)) totals[key] += value
    }
    for (const key of ["day_tx", "day_rx"] as const) {
      if (Number.isFinite(node[key])) totals[key] = (totals[key] ?? 0) + node[key]
    }
  }
  totals.offline = totals.total - totals.online
  if (totals.total) totals.uptimeRatio = totals.online / totals.total
  return totals
}

export function createHomeView(
  readNodes: () => readonly Node[], readFilters: () => HomeFilters,
  readPing: ReadPing = noPing, readExpiryWarningDays: () => number = () => 7,
) {
  const filtered = $derived.by(() => {
    const { group, country, query, sort } = readFilters()
    return directory(readNodes(), group, country, query, sort)
  })
  const summary = $derived(summarizeNodes(filtered.list, readPing, readExpiryWarningDays()))
  return {
    get directory() { return filtered },
    get summary() { return summary },
  }
}
