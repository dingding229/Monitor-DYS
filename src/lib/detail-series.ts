import type uPlot from "uplot"
import { bytes, speed } from "./format-common"
import { axisBytes } from "./detail-format"
import { withAlpha } from "./color"
/**
 * Derived in part from monitor-theme-default (MIT, Copyright (c) 2026 stqfdyr).
 */

const WINDOWS = [1, 6, 24, 168, 720, 2160]

/**
 * Generate range hours array from history_days.
 * Per SPEC §5.8:
 * - Presets `[1, 6, 24, 168, 720, 2160]` hours
 * - Remove any exceeding `history_days * 24`
 * - Remove any preset within 25% of the limit (`h * 1.25 > whole`)
 * - Append the limit itself (`history_days * 24`)
 */
export function rangesFor(historyDays?: number | null): number[] {
  const days = typeof historyDays === "number" && Number.isFinite(historyDays) && historyDays >= 1 ? Math.floor(historyDays) : 7
  const whole = Math.min(365, Math.max(1, days)) * 24
  const presets = WINDOWS.filter((h) => h * 1.25 <= whole)
  return [...presets, whole]
}

export function rangeLabel(hours: number): string {
  if (hours < 24) return `${hours} 小时`
  if (hours === 8760) return "1 年"
  const days = hours / 24
  return Number.isInteger(days) ? `${days} 天` : `${hours} 小时`
}
type MetricPoint = {
  ts: number
  minutes?: number
  cpu: number
  cpu_max?: number
  mem_used: number
  swap_used?: number
  disk_used: number
  net_rx: number
  net_tx: number
  net_rx_max?: number
  net_tx_max?: number
  tcp?: number
  udp?: number
  procs?: number
}

type PingPoint = {
  task_id: number
  ts: number
  latency: number | null
  loss?: number
}

export type MetricsResponse = {
  step?: number
  metrics?: MetricPoint[]
  ping?: PingPoint[]
  probes?: Record<string, string>
  loss?: Record<string, number>
}

const pad2 = (n: number) => String(n).padStart(2, "0")
const fmtHHMM = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
const fmtMMDD = (d: Date) => `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const isLocalMidnight = (d: Date) => d.getHours() === 0 && d.getMinutes() === 0

export function computeXAxisSplits(xs: number[], scaleMin: number, scaleMax: number, width: number, foundSpace?: number): number[] {
  if(!xs.length || xs.length===1 || !(scaleMax>scaleMin) || !Number.isFinite(scaleMax-scaleMin)) return xs.slice(0,1)
  const span=scaleMax-scaleMin, count=Math.max(2,Math.min(10,Math.floor((width-76)/Math.max(80,foundSpace||96))))
  const midnight=new Date(scaleMin*1000); midnight.setHours(0,0,0,0)
  if(+midnight<scaleMin*1000) midnight.setDate(midnight.getDate()+1)
  const ticks:number[]=[]
  if(span>86400){
    const days=span/86400, step=[1,2,3,5,7,10,14,15,21,30,60,90].find(s=>days/s<=count)??Math.ceil(days/count)
    // Calendar increments (rather than 86400 seconds) preserve midnight across DST.
    for(const day=new Date(midnight); +day<=scaleMax*1000; day.setDate(day.getDate()+step)) ticks.push(+day/1000)
    if(ticks.length>=2) return ticks
    ticks.length=0
  }
  const step=[60,120,300,600,900,1800,3600,7200,10800,14400,21600,43200].find(s=>span/s<=count)??43200
  const offset=new Date(scaleMin*1000).getTimezoneOffset()*60
  for(let t=Math.ceil((scaleMin-offset)/step)*step+offset;t<=scaleMax;t+=step) ticks.push(t)
  if(+midnight/1000<=scaleMax && !ticks.includes(+midnight/1000)) ticks.push(+midnight/1000)
  return ticks.length>=2 ? ticks.sort((a,b)=>a-b) : [Math.ceil(scaleMin),Math.floor(scaleMax)]
}

export function formatXAxisValues(xs: number[], splits: number[]): string[] {
  if (!splits.length) return []
  if (xs.length === 1 || splits.length === 1) {
    const d = new Date((splits[0] ?? xs[0]) * 1000)
    return [`${fmtMMDD(d)} ${fmtHHMM(d)}`]
  }

  const seen = new Set<string>()
  return splits.map(ts => {
    const d = new Date(ts * 1000)
    const label = isLocalMidnight(d) ? fmtMMDD(d) : fmtHHMM(d)
    if (seen.has(label)) return ""
    seen.add(label)
    return label
  })
}

type Chart = { title: string; data: [number[], ...(number | null)[][]]; series: uPlot.Series[]; subtitle?: string; yMax?: number; noLoss?: boolean; height?: number; yFormat?: (v:number)=>string }
const pct = (v:number) => `${v.toFixed(1)}%`
const percentTick = (v:number) => `${Math.round(v)}%`
const integer = (v:number) => String(Math.round(v))
function line(label: string, stroke: string, fmt: (v:number)=>string, dashed = false, fill = false, missing = "—"): uPlot.Series {
  return { label, stroke, width: dashed ? 1 : 1.5, dash: dashed ? [3, 3] : undefined,
    fill: fill ? withAlpha(stroke,.10) : undefined, value: (_,v) => v == null ? missing : fmt(v) }
}
export function metricCharts(resp: MetricsResponse | null, accent: string, peaks: boolean, mem: number, disk: number): Chart[] {
  const rows = [...(resp?.metrics ?? [])].sort((a,b)=>a.ts-b.ts)
  if (!rows.length) return []
  const step = resp?.step || rows[1]?.ts - rows[0].ts || 60
  const samples: (MetricPoint | null)[] = [], ts: number[] = []
  rows.forEach((r,i) => {
    if (i && r.ts-rows[i-1].ts > step*2) { ts.push(Math.floor((rows[i-1].ts+r.ts)/2)); samples.push(null) }
    ts.push(r.ts); samples.push(r.minutes === 0 ? null : r)
  })
  const col = (k:keyof MetricPoint, fallback?:keyof MetricPoint) => samples.map(r=>r?.[k] ?? (fallback && r?.[fallback]) ?? null)
  const cpu: Chart = { title:'CPU 使用率', data:[ts,col('cpu')], series:[line('平均 CPU',accent,pct,false,true)], yMax:100, yFormat:percentTick }
  if (peaks && rows.some(r=>r.cpu_max != null)) { cpu.data.push(col('cpu_max')); cpu.series.push(line('峰值',accent,pct,true)) }
  function storage(title:string, k:'mem_used'|'disk_used', cap:number, color:string): Chart {
    const chart: Chart = {title, data:[ts,col(k)], series:[line('使用量',color,bytes,false,true)], yFormat:axisBytes}
    if (cap>0) { chart.subtitle=bytes(cap); chart.yMax=cap*1.05; chart.data.push(ts.map(()=>cap)); chart.series.push(line('当前总容量','#94a3b8',bytes,true)) }
    return chart
  }
  const net: Chart = {title:'网络速率',data:[ts,col('net_rx'),col('net_tx')],series:[line('下载','#0284c7',speed,false,true),line('上传',accent,speed)],yFormat:v=>`${axisBytes(v)}/s`}
  if(peaks && rows.some(r=>r.net_rx_max!=null || r.net_tx_max!=null)) {
    net.data.push(col('net_rx_max','net_rx'),col('net_tx_max','net_tx')); net.series.push(line('下载峰值','#0284c7',speed,true),line('上传峰值',accent,speed,true))
  }
  const charts = [cpu, storage('内存用量','mem_used',mem,accent), storage('磁盘用量','disk_used',disk,'#d97706'), net]
  if(rows.some(r=>r.tcp!=null || r.udp!=null || r.procs!=null)) charts.push({title:'TCP / UDP / 进程数',height:180,data:[ts,col('tcp'),col('udp'),col('procs')],series:[line('TCP',accent,integer),line('UDP','#0284c7',integer),line('进程','#d97706',integer,true)]})
  return charts
}
const probeKey = 'dys:probes'
export function readProbes(): string[] | null {
  try { const saved = JSON.parse(localStorage.getItem(probeKey) ?? 'null'); return Array.isArray(saved) && saved.every(n=>typeof n==='string') ? saved : null } catch { return null }
}
export function saveProbes(names: string[] | null) {
  try { if (names) localStorage.setItem(probeKey, JSON.stringify(names)); else localStorage.removeItem(probeKey) } catch { /* selection still works without storage */ }
}
export function probeSelection(probes: { name: string; known: boolean; loss: number }[], saved: string[] | null) {
  const names = [...new Set(probes.map(p => p.name))]
  const matched = names.filter(name => saved?.includes(name))
  const active = matched.length ? matched : names
  let hasLoss = false, known = true
  const show = probes.map(probe => {
    if (!active.includes(probe.name)) return false
    hasLoss ||= probe.loss > 0
    known &&= probe.known
    return true
  })
  return { names, active, show, hasLoss, noLoss: !hasLoss && known }
}
export function toggleProbe(all:string[], active:string[], name:string, only:boolean) {
  if(only) return [name]
  if(active.includes(name)) return active.length > 1 ? active.filter(n=>n!==name) : active
  const next = all.filter(n=>n===name || active.includes(n))
  return next.length === all.length ? null : next
}
export function pingCharts(resp: MetricsResponse | null, accent:string) {
  const buckets = new Map<number, Map<number, PingPoint>>(), timestamps = new Set<number>()
  for (const row of resp?.ping ?? []) {
    let probe = buckets.get(row.task_id)
    if (!probe) buckets.set(row.task_id, probe = new Map())
    probe.set(row.ts, row)
    timestamps.add(row.ts)
  }
  const ids = [...buckets.keys()], times = [...timestamps].sort((a,b)=>a-b)
  const colors=[accent,'#2563eb','#d97706','#9333ea','#dc2626','#0891b2']
  const probes = ids.map((id,i)=>{
    let sum=0,count=0,loss=resp?.loss?.[id]??0,known=resp?.loss!=null
    const byTime = buckets.get(id)!
    for (const ts of times) {
      const r = byTime.get(ts)
      if (!r) continue
      if(r.latency!=null && Number.isFinite(r.latency)){sum+=r.latency;count++}
      if(r.loss!=null){known=true;loss=Math.max(loss,r.loss)}
    }
    return {id,name:resp?.probes?.[id]??`探测 #${id}`,color:colors[i%colors.length],avg:count?Math.round(sum/count):null,loss,known}
  })
  const charts:Chart[] = []
  for(const k of ['latency','loss'] as const){
    const latency=k==='latency', fmt=latency ? (v:number)=>`${Math.round(v)} ms` : pct
    if(!probes.length || (!latency && !probes.some(p=>p.loss>0))) continue
    charts.push({title:latency?'Ping 延迟':'Ping 丢包率',height:180,yFormat:v=>Number(v.toFixed(1))+(latency?' ms':'%'),
      data:[times,...ids.map(id=>times.map(ts=>{const r=buckets.get(id)!.get(ts); return r ? r[k] ?? (latency?null:0) : null}))],
      series:probes.map(p=>{const loss=resp?.loss?.[p.id]; return line(p.name+(latency && loss ? ` (丢 ${pct(loss)})`:''),p.color,fmt,false,false,latency ? "超时" : "0%")})})
  }
  return {charts,probes}
}
