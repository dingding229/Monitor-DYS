<script module lang="ts">
  const AXIS_FONT = "11px sans-serif"
  const cssVar = (n: string, fb: string) => (typeof document === "undefined" ? fb : getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb)
  const seriesColor = (s: uPlot.Series) => (typeof s.stroke === "string" ? s.stroke : "var(--accent)")
</script>

<script lang="ts">
  import { untrack, onDestroy, onMount } from "svelte"
  import "uplot/dist/uPlot.min.css"
  import { computeXAxisSplits, formatXAxisValues } from "@/lib/detail-series"
  import uPlot from "uplot"

  type ProbeItem = { id: number; name: string; color: string; avg: number | null }
  let { spec, subtitle = "", noLoss = false, show, probes, onProbe }: {
    spec: { title: string; subtitle?: string; data: uPlot.AlignedData; series: uPlot.Series[]; yFormat?: (v: number) => string; yMax?: number; height?: number }
    subtitle?: string; noLoss?: boolean; show?: boolean[]
    probes?: ProbeItem[]; onProbe?: (e: MouseEvent, name: string) => void
  } = $props()

  let container: HTMLDivElement | undefined = $state()
  let canvasHost: HTMLDivElement | undefined = $state()
  const bindBox = (el: HTMLDivElement) => { container = el }
  const bindCanvas = (el: HTMLDivElement) => { canvasHost = el }
  let chart = $state.raw<uPlot | null>(null)
  let ro: ResizeObserver | null = null
  let mo: MutationObserver | null = null
  let themeTick = $state(0)
  let hoverIdx = $state<number | null>(null)
  let hoverLeft = $state(0)
  let containerWidth = $state(320)
  let currentTicksJson = $state("[]")

  function formatHover(s: uPlot.Series, idx: number, i: number): string {
    const raw = (spec.data[i + 1] as (number | null | undefined)[] | undefined)?.[idx]
    if (typeof s.value === "function" && chart) return String(s.value(chart, raw as number, i + 1, idx))
    return raw == null ? "—" : spec.yFormat ? spec.yFormat(raw) : Number.isInteger(raw) ? String(raw) : raw.toFixed(1)
  }

  function renderChart() {
    if (!container || !canvasHost) return
    const width = containerWidth = container.clientWidth || 320, h = spec.height ?? 160
    untrack(() => chart)?.destroy()
    chart = null
    canvasHost.replaceChildren()
    const grid = cssVar("--chart-grid", "#e8eef5")
    const base = { stroke: cssVar("--chart-axis", "#64748b"), grid: { stroke: grid, width: 1 }, ticks: { stroke: grid, width: 1, size: 3 }, font: AXIS_FONT }
    const ts = spec.data[0] as number[], pts = ts.length > 0 && ts.length < 30
    try {
      chart = new uPlot({
        width: Math.max(180, width), height: h, padding: [6, 24, 0, 0],
        cursor: { drag: { x: false, y: false } }, legend: { show: false },
        scales: {
          x: { time: true, range: (_, a, b) => (a != null && a === b ? [a - 1800, b + 1800] : [a ?? 0, b ?? 1]) },
          y: { range: (_, __, max) => [0, spec.yMax ?? (max > 0 ? max * 1.1 : 10)] },
        },
        axes: [
          { ...base, size: 22, gap: 3, splits: (_, __, min, max, ___, sp) => computeXAxisSplits(ts, min, max, width, sp), values: (_, sp) => { const o = formatXAxisValues(ts, sp); currentTicksJson = JSON.stringify(o.filter(Boolean)); return o } },
          { ...base, gap: 4, size: (u, v) => { u.ctx.font = AXIS_FONT; return Math.ceil((v ?? []).reduce((m, s) => Math.max(m, u.ctx.measureText(s ?? "").width), 0)) + 9 }, values: (_, sp) => sp.map((v) => (spec.yFormat ? spec.yFormat(v) : Number.isInteger(v) ? String(v) : v.toFixed(1))) },
        ],
        hooks: { setCursor: [(u) => { const idx = u.cursor.idx; if (idx == null || (u.cursor.left !== undefined && u.cursor.left < 0)) { hoverIdx = null; return } hoverIdx = idx; hoverLeft = (u.cursor.left ?? 0) + u.bbox.left / (devicePixelRatio || 1) }] },
        series: [{ label: "时间" }, ...spec.series.map((s) => ({ ...s, points: { show: pts, size: 4, ...(s.points ?? {}) } }))],
      }, spec.data, canvasHost)
    } catch {}
  }

  onMount(() => {
    if (container && globalThis.ResizeObserver) {
      ro = new ResizeObserver(([e]) => { const w = e?.contentRect?.width; if (w && chart) { containerWidth = w; chart.setSize({ width: Math.max(180, w | 0), height: spec.height ?? 160 }) } })
      ro.observe(container)
    }
    if (globalThis.MutationObserver) {
      mo = new MutationObserver(() => themeTick++)
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
    }
  })

  $effect(() => { void spec; void themeTick; if (container) renderChart() })
  $effect(() => { const u = chart, mask = show; if (u && mask) u.batch(() => mask.forEach((v, i) => { if (u.series[i + 1]?.show !== v) u.setSeries(i + 1, { show: v }) })) })
  onDestroy(() => { ro?.disconnect(); mo?.disconnect(); chart?.destroy(); chart = null })
</script>

<div data-testid="chart" data-ticks={currentTicksJson} class="panel ch-card">
  <div class="ch-head">
    <div class="ch-title">
      <h4>{spec.title}</h4>
      {#if noLoss}<span class="no-loss-pill" data-testid="no-loss">无丢包</span>{/if}
      {#if subtitle || spec.subtitle}<span class="mono ch-sub">{subtitle || spec.subtitle}</span>{/if}
    </div>
    {#if !probes}
      <div class="ch-legs">
        {#each spec.series as s, i}{#if show?.[i] !== false}<span class="leg"><i class={s.dash ? "dashed" : ""} style="color:{seriesColor(s)}"></i>{s.label}</span>{/if}{/each}
      </div>
    {/if}
  </div>
  {#if probes}
    <div class="probe-controls" role="group" aria-label="选择探测节点">
      {#each probes as p, i (p.id)}
        <button type="button" class="probe" data-testid="probe-chip" data-probe={p.name} aria-pressed={show?.[i]} style="--probe:{p.color}" onclick={(e) => onProbe?.(e, p.name)}>
          <i aria-hidden="true"></i>{p.name} <span class="mono">{p.avg == null ? "—" : `${p.avg}ms`}</span>
        </button>
      {/each}
      <button type="button" class="probe-all" data-testid="probe-all" disabled={show?.every(Boolean)} onclick={(e) => onProbe?.(e, "")}>全部</button>
    </div>
  {/if}

  <div use:bindBox onmouseleave={() => (hoverIdx = null)} role="img" aria-label={spec.title} style="height:{spec.height ?? 160}px" class="ch-host">
    <div use:bindCanvas class="ch-canvas"></div>
    {#if hoverIdx !== null}
      {@const ts = (spec.data[0] as number[] | undefined)?.[hoverIdx]}
      {#if ts}
        <div class="ch-tip" style={hoverLeft > containerWidth * 0.55 ? `right:${Math.max(4, Math.round(containerWidth - hoverLeft + 10))}px` : `left:${Math.max(4, Math.round(hoverLeft + 10))}px`}>
          <div class="mono fg-subtle">{new Date(ts * 1000).toLocaleString("zh-CN", { hour12: false })}</div>
          {#each spec.series as s, i}{#if show?.[i] !== false}
            <div class="mono ch-tip-row"><span class="leg"><i class={s.dash ? "dashed" : ""} style="color:{seriesColor(s)}"></i>{s.label}</span><b>{formatHover(s, hoverIdx, i)}</b></div>
          {/if}{/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .ch-card { position: relative; padding: 12px 14px; }
  .ch-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 8px; }
  .ch-title { display: flex; align-items: baseline; gap: 8px; }
  .ch-title h4 { font-size: 12px; font-weight: 700; }
  .ch-sub { font-size: 11px; color: var(--fg-muted); }
  .ch-legs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 11px; color: var(--fg-muted); }
  .ch-host { position: relative; width: 100%; overflow: hidden; }
  .ch-canvas { width: 100%; height: 100%; }
  .ch-tip { pointer-events: none; position: absolute; top: 4px; z-index: 20; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); padding: 4px 8px; font-size: 11px; }
  .ch-tip-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .leg { display: inline-flex; align-items: center; gap: 4px; }
  .leg i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  .leg .dashed { width: 9px; height: 0; border-radius: 0; border-top: 1px dashed; background: none; }
  .probe-controls { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 4px 0 10px; }
  .probe-controls button { font-size: 12px; padding: 3px 9px; cursor: pointer; }
  button.probe { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface-2); color: var(--fg-muted); }
  .probe i { width: 7px; height: 7px; border-radius: 50%; background: var(--offline); }
  .probe[aria-pressed="true"] { color: var(--fg); font-weight: 600; border-color: color-mix(in srgb, var(--probe) 55%, var(--border)); background: color-mix(in srgb, var(--probe) 11%, var(--surface)); }
  .probe[aria-pressed="true"] i { background: var(--probe); }
  .probe-all { color: var(--fg-muted); text-decoration: underline; background: transparent; border: 0; }
  .probe-all:disabled { color: var(--fg-subtle); text-decoration: none; cursor: default; }
</style>
