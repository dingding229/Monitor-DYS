<script module lang="ts">
  const AXIS_FONT = "11px -apple-system, BlinkMacSystemFont, sans-serif"
  function cssVar(name: string, fallback: string): string {
    return typeof document === "undefined" ? fallback : getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
  }
  function seriesColor(s: uPlot.Series): string {
    return typeof s.stroke === "string" ? s.stroke : "var(--accent)"
  }
</script>

<script lang="ts">
  import { untrack, onDestroy, onMount, type Snippet } from "svelte"
  import "uplot/dist/uPlot.min.css"
  import { computeXAxisSplits, formatXAxisValues } from "@/lib/detail-series"
  import uPlot from "uplot"

  let {
    title,
    subtitle = "",
    noLoss = false,
    data,
    show,
    controls,
    series,
    yFormat,
    yMax,
    height = 160,
  }: {
    show?: boolean[]
    controls?: Snippet
    title: string
    noLoss?: boolean
    subtitle?: string
    data: uPlot.AlignedData
    series: uPlot.Series[]
    yFormat?: (v: number) => string
    yMax?: number
    height?: number
  } = $props()

  let container: HTMLDivElement | undefined = $state()
  let canvasHost: HTMLDivElement | undefined = $state()
  let chart = $state.raw<uPlot | null>(null)
  let ro: ResizeObserver | null = null
  let mo: MutationObserver | null = null
  let schemeTick = $state(0)

  let hoverIdx = $state<number | null>(null)
  let hoverLeft = $state(0)
  let containerWidth = $state(320)
  let currentTicksJson = $state("[]")

  function formatHover(s: uPlot.Series, idx: number, i: number): string {
    const raw = (data[i + 1] as (number | null | undefined)[] | undefined)?.[idx]
    if (typeof s.value === "function" && chart) return String(s.value(chart, raw as number, i + 1, idx))
    return raw == null ? "—" : yFormat ? yFormat(raw) : Number.isInteger(raw) ? String(raw) : raw.toFixed(1)
  }

  function buildOptions(width: number): uPlot.Options {
    const axisColor = cssVar("--chart-axis", "#64748b")
    const gridColor = cssVar("--chart-grid", "#eef2f6")
    const baseAxis = { stroke: axisColor, grid: { stroke: gridColor, width: 1 }, ticks: { stroke: gridColor, width: 1, size: 3 }, font: AXIS_FONT }
    const ts = data[0] as number[]
    const showPoints = ts.length > 0 && ts.length < 30

    return {
      width: Math.max(180, width),
      height,
      padding: [6, 24, 0, 0],
      cursor: { drag: { x: false, y: false } },
      legend: { show: false },
      scales: {
        x: { time: true, range: (_, a, b) => (a != null && a === b ? [a - 1800, b + 1800] : [a ?? 0, b ?? 1]) },
        y: { range: (_, __, max) => [0, yMax ?? (max > 0 ? max * 1.1 : 10)] },
      },
      axes: [
        {
          ...baseAxis,
          size: 22,
          gap: 3,
          splits: (_, __, min, max, ___, space) => computeXAxisSplits(ts, min, max, width, space),
          values: (_, splits) => {
            const out = formatXAxisValues(ts, splits)
            currentTicksJson = JSON.stringify(out.filter(Boolean))
            return out
          },
        },
        {
          ...baseAxis,
          gap: 4,
          size: (self, vals) => {
            const ctx = self.ctx
            ctx.save()
            ctx.font = AXIS_FONT
            const w = (vals ?? []).reduce((m, s) => Math.max(m, ctx.measureText(s ?? "").width), 0)
            ctx.restore()
            return Math.ceil(w) + 9
          },
          values: (_, splits) => splits.map((v) => (yFormat ? yFormat(v) : Number.isInteger(v) ? String(v) : v.toFixed(1))),
        },
      ],
      hooks: {
        setCursor: [(u) => {
          const idx = u.cursor.idx
          if (idx == null || (u.cursor.left !== undefined && u.cursor.left < 0)) { hoverIdx = null; return }
          hoverIdx = idx
          hoverLeft = (u.cursor.left ?? 0) + u.bbox.left / (typeof devicePixelRatio === "number" ? devicePixelRatio : 1)
        }],
      },
      series: [{ label: "时间" }, ...series.map((s) => ({ ...s, points: { show: showPoints, size: 4, ...(s.points ?? {}) } }))],
    }
  }

  function renderChart() {
    if (!container || !canvasHost) return
    const width = container.clientWidth || 320
    containerWidth = width
    untrack(() => chart)?.destroy()
    chart = null
    canvasHost.replaceChildren()
    try { chart = new uPlot(buildOptions(width), data, canvasHost) } catch {}
  }

  onMount(() => {
    if (container && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(([e]) => {
        const w = e?.contentRect?.width
        if (w && chart) { containerWidth = w; chart.setSize({ width: Math.max(180, Math.floor(w)), height }) }
      })
      ro.observe(container)
    }
    if (typeof MutationObserver !== "undefined") {
      mo = new MutationObserver(() => { schemeTick++ })
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-scheme"] })
    }
  })

  $effect(() => { void data; void series; void yMax; void schemeTick; if (container) renderChart() })
  $effect(() => {
    const u = chart, mask = show
    if (u && mask) u.batch(() => mask.forEach((v, i) => { if (u.series[i + 1]?.show !== v) u.setSeries(i + 1, { show: v }) }))
  })
  onDestroy(() => { ro?.disconnect(); mo?.disconnect(); chart?.destroy(); chart = null })
</script>

{#snippet leg(s: uPlot.Series)}
  <span class="leg"><i class:dashed={!!s.dash} style:color={seriesColor(s)}></i>{s.label}</span>
{/snippet}

<div data-testid="chart" data-ticks={currentTicksJson} class="panel ch-card">
  <div class="ch-head">
    <div class="ch-title">
      <h4>{title}</h4>
      {#if noLoss}<span class="no-loss-pill" data-testid="no-loss">无丢包</span>{/if}
      {#if subtitle}<span class="tnum ch-sub">{subtitle}</span>{/if}
    </div>
    {#if !controls}
      <div class="ch-legs">
        {#each series as s, i}{#if show?.[i] !== false}{@render leg(s)}{/if}{/each}
      </div>
    {/if}
  </div>
  {@render controls?.()}

  <div bind:this={container} onmouseleave={() => (hoverIdx = null)} role="img" aria-label={title} style:height="{height}px" class="ch-host">
    <div bind:this={canvasHost} class="ch-canvas"></div>
    {#if hoverIdx !== null}
      {@const ts = (data[0] as number[] | undefined)?.[hoverIdx]}
      {#if ts}
        <div
          class="ch-tip"
          style={hoverLeft > containerWidth * 0.55
            ? `right:${Math.max(4, Math.round(containerWidth - hoverLeft + 10))}px`
            : `left:${Math.max(4, Math.round(hoverLeft + 10))}px`}
        >
          <div class="tnum fg-subtle">{new Date(ts * 1000).toLocaleString("zh-CN", { hour12: false })}</div>
          {#each series as s, i}{#if show?.[i] !== false}
            <div class="tnum ch-tip-row">{@render leg(s)}<b>{formatHover(s, hoverIdx, i)}</b></div>
          {/if}{/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .ch-card { position: relative; padding: 12px; }
  .ch-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 6px; }
  .ch-title { display: flex; align-items: baseline; gap: 6px; }
  .ch-title h4 { font-size: 13px; font-weight: 700; color: var(--fg); }
  .ch-sub { font-size: 12px; color: var(--fg-muted); }
  .ch-legs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 11px; color: var(--fg-muted); }
  .ch-host { position: relative; width: 100%; overflow: hidden; }
  .ch-canvas { width: 100%; height: 100%; }
  .ch-tip {
    pointer-events: none; position: absolute; top: 4px; z-index: 20;
    border-radius: 6px; border: 1px solid var(--border); background: var(--surface);
    padding: 4px 8px; font-size: 11px;
  }
  .ch-tip-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--fg); }
  .leg { display: inline-flex; align-items: center; gap: 4px; }
  .leg i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  .leg .dashed { width: 9px; height: 0; border-radius: 0; border-top: 1px dashed; background: none; }
</style>
