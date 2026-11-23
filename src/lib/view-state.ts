import { ALL_GROUP, UNGROUPED, type GroupKey, type Node } from "./api"
import { percentNum, expiry, regionName } from "./format-common"
export type SortKey = "default" | "name" | "cpu" | "mem" | "disk" | "tx" | "rx" | "expiry" | "traffic"

type VisitorPrefs = {
  layout?: "grid" | "table"
  sort?: SortKey
}

const KEYS = {
  layout: "dys.layout",
  sort: "dys.sort",
} as const

const VALID_SORTS = new Set<SortKey>(["default", "name", "cpu", "mem", "disk", "tx", "rx", "expiry", "traffic"])

export function loadPrefs(storage?: Storage): VisitorPrefs {
  const prefs: VisitorPrefs = {}
  try {
    const store = storage ?? localStorage

    const layout = store.getItem(KEYS.layout)
    if (layout === "grid" || layout === "table") prefs.layout = layout

    const sort = store.getItem(KEYS.sort) as SortKey | null
    if (sort && VALID_SORTS.has(sort)) prefs.sort = sort
  } catch {
    // Storage disabled or blocked
  }
  return prefs
}

export function savePref<K extends keyof VisitorPrefs>(key: K, value: NonNullable<VisitorPrefs[K]>, storage?: Storage): void {
  try {
    (storage ?? localStorage).setItem(KEYS[key], value)
  } catch {
    // Storage disabled or blocked
  }
}

export function readView(search = location.search): {group: GroupKey; country: string|null; query: string; sort: SortKey} {
  const p = new URLSearchParams(search), g = p.get('g'), sort = p.get('sort') as SortKey
  const group: GroupKey = g === null ? ALL_GROUP : g === '~' ? UNGROUPED : g.replace(/^~~/, '~')
  return {group, country:p.get('c')?.toUpperCase() || null, query:p.get('q') ?? '', sort:VALID_SORTS.has(sort) ? sort : loadPrefs().sort ?? 'default'}
}
export function writeView(group:GroupKey, country:string|null, query:string, sort:SortKey) {
  const url = new URL(location.href)
  const values = {g:group===ALL_GROUP ? '' : group===UNGROUPED ? '~' : group.replace(/^~/,'~~'), c:country, q:query, sort:sort==='default'?'':sort}
  for (const [k,v] of Object.entries(values)) { if(v) url.searchParams.set(k,v); else url.searchParams.delete(k) }
  if (url.href!==location.href) history.replaceState(history.state,'',url)
}
export function directory(nodes:readonly Node[], group:GroupKey, country:string|null, search:string, sort:SortKey) {
  const counts = new Map<GroupKey,number>(), grouped:Node[] = [], list:Node[] = [], q=search.trim().toLowerCase()
  for (const n of nodes) {
    const key=n.group || UNGROUPED; counts.set(key,(counts.get(key)??0)+1)
    if(group!==ALL_GROUP && group!==key) continue
    grouped.push(n)
    if(country && n.country?.toUpperCase()!==country) continue
    if(q && ![n.name,n.country,n.os,n.public_remark,regionName(n.country)].some(v=>v?.toLowerCase().includes(q))) continue
    list.push(n)
  }
  const score=(n:Node) => {
    const m=n.online?n.metrics:null
    switch(sort){
      case 'cpu':return m?.cpu??-1
      case 'mem':return m?percentNum(m.mem_used,m.mem_total):-1
      case 'disk':return m?percentNum(m.disk_used,m.disk_total):-1
      case 'rx':return m?.net_rx??-1
      case 'tx':return m?.net_tx??-1
      case 'traffic':return (n.month_rx??0)+(n.month_tx??0)
      case 'expiry':return -(expiry(n).days??Infinity)
      default:return 0
    }
  }
  if(sort!=='default') list.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'zh-CN'):score(b)-score(a))
  const ungrouped=counts.get(UNGROUPED); counts.delete(UNGROUPED)
  const tabs: { key: GroupKey; label: string; count: number }[] = []
  if (counts.size) {
    tabs.push({ key: ALL_GROUP, label: "全部", count: nodes.length })
    for (const [key, count] of counts) tabs.push({ key, label: String(key), count })
    if (ungrouped) tabs.push({ key: UNGROUPED, label: "未分组", count: ungrouped })
  }
  return {grouped,list,tabs}
}
export type Directory = ReturnType<typeof directory>
