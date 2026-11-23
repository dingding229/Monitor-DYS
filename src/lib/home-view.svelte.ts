/** Home model facade; country aggregation is loaded with the map. */
import { onMount, untrack } from "svelte"
import { num, type Node } from "./api"
import { hasWarning, noPing, type ReadPing } from "./home-summary.svelte"
export { createHomeView, summarizeNodes } from "./home-summary.svelte"
export type { HomeFilters, NodeStatus, ReadPing } from "./home-summary.svelte"

export type CountryCounts = {
  code: string; online: number; total: number; tx: number; rx: number; latency: number | null; warn: boolean
}

type CountryRollup = Omit<CountryCounts, "latency"> & { latencySum: number; measured: number }

/**
 * Sort countries largest first, then by code. The global rate and mean are
 * per node (including unlocated nodes), not unweighted averages of countries.
 */
export function aggregateCountries(nodes: readonly Node[], readPing: ReadPing = noPing) {
  const byCode = new Map<string, CountryRollup>()
  let online = 0, latencySum = 0, measured = 0
  for (const node of nodes) {
    const ping = node.online ? readPing(node.id) : undefined
    const latency = num(ping?.latency) && ping.latency >= 0 ? ping.latency : null
    if (node.online) online++
    if (latency !== null) { latencySum += latency; measured++ }

    const code = node.country?.trim().toUpperCase()
    if (!code) continue
    let counts = byCode.get(code)
    if (!counts) {
      counts = { code, online: 0, total: 0, tx: 0, rx: 0, warn: false, latencySum: 0, measured: 0 }
      byCode.set(code, counts)
    }
    counts.total++
    counts.warn ||= !node.online || hasWarning(node, ping)
    if (node.online) {
      counts.online++
      counts.tx += node.metrics?.net_tx ?? 0
      counts.rx += node.metrics?.net_rx ?? 0
      if (latency !== null) { counts.latencySum += latency; counts.measured++ }
    }
  }
  const countries: CountryCounts[] = Array.from(byCode.values(), ({ latencySum, measured, ...counts }) => ({
    ...counts, latency: measured ? latencySum / measured : null,
  }))
  countries.sort((a, b) => b.total - a.total || a.code.localeCompare(b.code))
  return { countries, totals: {
    regions: countries.length,
    onlineRate: nodes.length ? online / nodes.length : 0,
    avgLatency: measured ? latencySum / measured : null,
  } }
}

export function createCountryView(readNodes: () => readonly Node[], isHovered: () => boolean, readPing: ReadPing = noPing) {
  // The derived is only read on an eligible tick: Ping-only changes refresh the
  // map too, without retaining whole frames or re-aggregating on every push.
  const current = $derived(aggregateCountries(readNodes(), readPing))
  let aggregate = $state.raw(untrack(() => current))
  onMount(() => {
    const timer = setInterval(() => {
      if (!isHovered() && !document.hidden) aggregate = current
    }, 3000)
    return () => clearInterval(timer)
  })
  return { get aggregate() { return aggregate } }
}
