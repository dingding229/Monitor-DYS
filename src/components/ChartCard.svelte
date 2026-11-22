<script lang="ts">
  import { untrack, onDestroy, onMount, type Snippet } from "svelte"
  import "uplot/dist/uPlot.min.css"
  import { computeXAxisSplits, formatXAxisValues } from "@/lib/detail-series"
  import uPlot from "uplot"

  let {
    title,
    subtitle = "", noLoss = false,
    data, show, controls,
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
  let resizeObserver: ResizeObserver | null = null

  let hoverIdx = $state<number | null>(null)
  let hoverLeft = $state<number>(0)
  let containerWidth = $state<number>(320)
  let currentTicksJson = $state<string>("[]")

  function seriesColor(s: uPlot.Series): string {
    return typeof s.stroke === "string" ? s.stroke : "var(--accent)"
  }

  function formatHoverValue(s: uPlot.Series, idx: number, seriesIdx: number): string {
    const col = data[seriesIdx + 1] as (number | null | undefined)[] | undefined
    const raw = col ? col[idx] : null
    if (typeof s.value === "function" && chart) {
      return String(s.value(chart, raw as number, seriesIdx + 1, idx))
    }
    if (raw === null || raw === undefined) return "—"
    return yFormat ? yFormat(raw) : Number.isInteger(raw) ? String(raw) : raw.toFixed(1)
  }

  let hoverTimeStr = $derived.by(() => {
    if (hoverIdx === null) return ""
    const tsCol = data[0] as number[] | undefined
    const ts = tsCol ? tsCol[hoverIdx] : undefined
    return ts ? new Date(ts * 1000).toLocaleString("zh-CN", { hour12: false }) : ""
  })

  function buildOptions(width: number): uPlot.Options {
    const axisFont = "11px -apple-system, BlinkMacSystemFont, sans-serif"
    const tickLength = 3, yGap = 4
    const axisColor = "#737373"
    const gridColor = "rgba(0,0,0,0.05)"
    // uPlot may finish an axis pass after Svelte has switched to another node.
    const timestamps = data[0] as number[], pointCount = timestamps.length
    // Per SPEC-v1.2 §6.f: Show point circles only when there are fewer than 30 points
    const showPoints = pointCount > 0 && pointCount < 30

    return {
      width: Math.max(180, width),
      height,
      // Per SPEC-v1.2 §6.c: right padding 24px so the last X-axis tick label is never clipped
      padding: [6, 24, 0, 0],
      cursor: {
        drag: { x: false, y: false },
      },
      legend: {
        show: false,
      },
      scales: {
        x: {
          time: true,
          range: (_u, dataMin, dataMax) => {
            if (dataMin !== null && dataMax !== null && dataMin === dataMax) {
              return [dataMin - 1800, dataMax + 1800]
            }
            return [dataMin ?? 0, dataMax ?? 1]
          },
        },
        y: {
          range: (_u, _min, max) => [0, yMax ?? (max > 0 ? max * 1.1 : 10)],
        },
      },
      axes: [
        {
          stroke: axisColor,
          grid: { stroke: gridColor, width: 1 },
          ticks: { stroke: gridColor, width: 1, size: tickLength },
          size: 22,
          gap: 3,
          font: axisFont,
          splits: (_u, _axisIdx, scaleMin, scaleMax, _foundIncr, foundSpace) =>
            computeXAxisSplits(timestamps, scaleMin, scaleMax, width, foundSpace),
          values: (_u, splits) => {
            const formatted = formatXAxisValues(timestamps, splits)
            currentTicksJson = JSON.stringify(formatted.filter(Boolean))
            return formatted
          },
        },
        {
          stroke: axisColor,
          grid: { stroke: gridColor, width: 1 },
          ticks: { stroke: gridColor, width: 1, size: tickLength },
          size: (self, values) => {
            // uPlot asks once without labels, then again with formatted ticks. Measure in CSS pixels.
            const ctx = self.ctx
            ctx.save(); ctx.font = axisFont
            const longest = (values ?? []).reduce((max, label) => Math.max(max, ctx.measureText(label ?? "").width), 0)
            ctx.restore()
            return Math.ceil(longest) + yGap + tickLength + 2
          },
          gap: yGap,
          font: axisFont,
          values: (_u, splits) =>
            splits.map((v) => (yFormat ? yFormat(v) : Number.isInteger(v) ? String(v) : v.toFixed(1))),
        },
      ],
      hooks: {
        setCursor: [
          (u) => {
            const idx = u.cursor.idx
            if (idx === null || idx === undefined || (u.cursor.left !== undefined && u.cursor.left < 0)) {
              hoverIdx = null
              return
            }
            hoverIdx = idx
            hoverLeft = (u.cursor.left ?? 0) + u.bbox.left / (typeof devicePixelRatio === "number" ? devicePixelRatio : 1)
          },
        ],
      },
      series: [
        {
          label: "时间",
        },
        ...series.map((s) => ({
          ...s,
          points: {
            show: showPoints,
            size: 4,
            ...(s.points ?? {}),
          },
        })),
      ],
    }
  }

  function renderChart() {
    if (!container || !canvasHost) return
    const width = container.clientWidth || 320
    containerWidth = width
    untrack(() => chart)?.destroy()
    chart = null
    canvasHost.replaceChildren()
    try {
      chart = new uPlot(buildOptions(width), data, canvasHost)
    } catch {
      // fallback if canvas is unavailable in test env
    }
  }

  onMount(() => {
    if (container && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver((entries) => {
        const w = entries[0]?.contentRect?.width
        if (w && chart) {
          containerWidth = w
          chart.setSize({ width: Math.max(180, Math.floor(w)), height })
        }
      })
      resizeObserver.observe(container)
    }
  })

  $effect(() => {
    void data
    void series
    void yMax
    if (container) {
      renderChart()
    }
  })

  // Visibility changes use uPlot's own scale invalidation, not the construction effect.
  $effect(() => {
    const u=chart, mask=show
    if(u && mask) u.batch(()=>mask.forEach((visible,i)=>{
      if(u.series[i+1]?.show !== visible) u.setSeries(i+1,{show:visible})
    }))
  })
  onDestroy(() => {
    resizeObserver?.disconnect()
    chart?.destroy()
    chart = null
  })
</script>

<div
  data-testid="chart"
  data-ticks={currentTicksJson}
  class="panel relative rounded-[8px] border border-neutral-200 bg-white p-[12px]"
>
  <!-- Title on the left, compact series legend on the right -->
  <div class="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
    <div class="flex items-baseline gap-1.5">
      <h4 class="text-[12px] font-semibold text-neutral-800">{title}</h4>
      {#if noLoss}<span class="no-loss-pill" data-testid="no-loss">无丢包</span>{/if}
      {#if subtitle}
        <span class="tnum text-[11px] text-neutral-400">{subtitle}</span>
      {/if}
    </div>

    {#if !controls}<div class="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
      {#each series as s, i}{#if show?.[i] !== false}
        {@render legendItem(s)}
      {/if}{/each}
    </div>{/if}
  </div>
  {@render controls?.()}

  <!-- Chart canvas container & compact cursor-following tooltip -->
  <div
    bind:this={container}
    data-ticks={currentTicksJson}
    onmouseleave={() => (hoverIdx = null)}
    role="img"
    aria-label={title}
    style="height: {height}px;"
    class="relative w-full overflow-hidden"
  >
    <div bind:this={canvasHost} data-ticks={currentTicksJson} class="h-full w-full"></div>
    {#if hoverIdx !== null && hoverTimeStr}
      <div
        class="pointer-events-none absolute z-20 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px]"
        style="top: 4px; {hoverLeft > containerWidth * 0.55
          ? `right: ${Math.max(4, Math.round(containerWidth - hoverLeft + 10))}px;`
          : `left: ${Math.max(4, Math.round(hoverLeft + 10))}px;`}"
      >
        <div class="tnum font-medium text-neutral-500">{hoverTimeStr}</div>
        {#each series as s, i}{#if show?.[i] !== false}
          <div class="tnum flex items-center justify-between gap-2 text-neutral-800">
            {@render legendItem(s)}
            <span class="font-semibold">{formatHoverValue(s, hoverIdx, i)}</span>
          </div>
        {/if}{/each}
      </div>
    {/if}
  </div>
</div>

{#snippet legendItem(s:uPlot.Series)}
  <span class="legend-item"><i class:dashed={!!s.dash} style:color={seriesColor(s)}></i>{s.label}</span>
{/snippet}
<style>
  .legend-item {display:inline-flex;align-items:center;gap:4px}
  .legend-item i {width:7px;height:7px;border-radius:2px;background:currentColor}
  .legend-item .dashed {width:9px;height:0;border-top:1px dashed;background:none}
</style>
