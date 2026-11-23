/**
 * Home presentation model. `createHomeView` shares one directory between the
 * directory UI and detail navigation. `directory.grouped` is the map input
 * (group only); `directory.list` is the visible/sorted list and overview input.
 * Mount `createCountryView` in the map, not in App, and pass its hover predicate
 * (including any active keyboard/pointer badge). Its timer lives with the map.
 */
import { onMount, untrack } from "svelte"
import type { GroupKey, Node } from "./api"
import { directory, type SortKey } from "./view-state"

export type HomeFilters = {
  group: GroupKey
  country: string | null
  query: string
  sort: SortKey
}

export function summarizeNodes(nodes: readonly Node[]) {
  const totals = {
    total: nodes.length, online: 0, offline: 0, countries: new Set<string>(),
    tx: 0, rx: 0, month_tx: 0, month_rx: 0, total_tx: 0, total_rx: 0,
    day_tx: null as number | null, day_rx: null as number | null,
  }
  for (const node of nodes) {
    const code = node.country?.trim().toUpperCase()
    if (code) totals.countries.add(code)
    if (node.online) {
      totals.online++
      totals.tx += node.metrics?.net_tx ?? 0
      totals.rx += node.metrics?.net_rx ?? 0
    }
    for (const key of ["month_tx", "month_rx", "total_tx", "total_rx"] as const) {
      const value = node[key] ?? node.metrics?.[key]
      if (Number.isFinite(value)) totals[key] += value
    }
    for (const key of ["day_tx", "day_rx"] as const) {
      if (Number.isFinite(node[key])) totals[key] = (totals[key] ?? 0) + node[key]
    }
  }
  totals.offline = totals.total - totals.online
  return totals
}

export type CountryCounts = {
  code: string; online: number; total: number; tx: number; rx: number; nodeNames: string[]
}

/** Map counts sorted largest first, then by code. Unlocated nodes still count in the global totals. */
export function aggregateCountries(nodes: readonly Node[]) {
  const byCode = new Map<string, CountryCounts>()
  let online = 0
  for (const node of nodes) {
    if (node.online) online++
    const code = node.country?.trim().toUpperCase()
    if (!code) continue
    let counts = byCode.get(code)
    if (!counts) {
      counts = { code, online: 0, total: 0, tx: 0, rx: 0, nodeNames: [] }
      byCode.set(code, counts)
    }
    counts.total++
    if (node.online) {
      counts.online++
      counts.tx += node.metrics?.net_tx ?? 0
      counts.rx += node.metrics?.net_rx ?? 0
    }
    counts.nodeNames.push(node.name)
  }
  const countries = [...byCode.values()].sort((a, b) => b.total - a.total || a.code.localeCompare(b.code))
  return { countries, online, offline: nodes.length - online, total: nodes.length }
}

export function createHomeView(readNodes: () => readonly Node[], readFilters: () => HomeFilters) {
  const filtered = $derived.by(() => {
    const { group, country, query, sort } = readFilters()
    return directory(readNodes(), group, country, query, sort)
  })
  const summary = $derived(summarizeNodes(filtered.list))
  return {
    get directory() { return filtered },
    get summary() { return summary },
  }
}

/** Use during map component initialization. Skip ticks while hovered or while the document is hidden. */
export function createCountryView(readNodes: () => readonly Node[], isHovered: () => boolean) {
  const first = untrack(readNodes)
  let previous = new WeakRef(first)
  let aggregate = $state.raw(aggregateCountries(first))
  onMount(() => {
    const timer = setInterval(() => {
      if (isHovered() || document.hidden) return
      const next = readNodes()
      if (next === previous.deref()) return
      previous = new WeakRef(next)
      aggregate = aggregateCountries(next)
    }, 3000)
    return () => clearInterval(timer)
  })
  return { get aggregate() { return aggregate } }
}
