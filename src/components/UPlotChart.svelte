<script lang="ts">
  import { onDestroy, onMount } from "svelte"
  import uPlot from "uplot"

  let {
    title,
    subtitle = "",
    data,
    series,
    yFormat,
    yMin = 0,
    yMax,
    height = 160,
    partialBuckets = [],
  }: {
    title: string
    subtitle?: string
    data: uPlot.AlignedData
    series: uPlot.Series[]
    yFormat?: (v: number) => string
    yMin?: number
    yMax?: number
    height?: number
    partialBuckets?: { from: number; to: number }[]
  } = $props()

  let container: HTMLDivElement | undefined = $state()
  let chart: uPlot | null = null
  let resizeObserver: ResizeObserver | null = null

  let hoverIdx = $state<number | null>(null)
  let hoverLeft = $state<number>(0)
  let containerWidth = $state<number>(320)

  const HHMM = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" })
  const MDHHMM = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })

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
    const axisColor = "#6b7280"
    const gridColor = "rgba(0,0,0,0.05)"

    return {
      width: Math.max(180, width),
      height,
      padding: [8, 10, 0, 0],
      cursor: {
        drag: { x: false, y: false },
      },
      legend: {
        show: false,
      },
      scales: {
        x: { time: true },
        y: {
          range: (_u, dataMin, dataMax) => {
            const lo = yMin !== undefined ? yMin : (dataMin ?? 0)
            const hi =
              yMax !== undefined
                ? yMax
                : dataMax !== null && dataMax !== undefined && dataMax > lo
                  ? dataMax * 1.1
                  : lo + 10
            return [lo, hi]
          },
        },
      },
      axes: [
        {
          stroke: axisColor,
          grid: { stroke: gridColor, width: 1 },
          ticks: { stroke: gridColor, width: 1, size: 3 },
          font: "10.5px -apple-system, BlinkMacSystemFont, sans-serif",
          values: (_u, splits) => {
            if (!splits.length) return []
            const span = (splits[splits.length - 1] ?? 0) - (splits[0] ?? 0)
            const fmt = span > 86400 * 1.2 ? MDHHMM : HHMM
            return splits.map((s) => fmt.format(s * 1000))
          },
        },
        {
          stroke: axisColor,
          grid: { stroke: gridColor, width: 1 },
          ticks: { stroke: gridColor, width: 1, size: 3 },
          size: 52,
          font: "10.5px -apple-system, BlinkMacSystemFont, sans-serif",
          values: (_u, splits) =>
            splits.map((v) => (yFormat ? yFormat(v) : Number.isInteger(v) ? String(v) : v.toFixed(1))),
        },
      ],
      hooks: {
        drawAxes: [
          (u) => {
            if (!partialBuckets.length) return
            const ctx = u.ctx
            ctx.save()
            ctx.fillStyle = "rgba(0,0,0,0.035)"
            for (const b of partialBuckets) {
              const x0 = Math.max(u.bbox.left, u.valToPos(b.from, "x", true))
              const x1 = Math.min(u.bbox.left + u.bbox.width, u.valToPos(b.to, "x", true))
              if (x1 > x0) {
                ctx.fillRect(x0, u.bbox.top, x1 - x0, u.bbox.height)
              }
            }
            ctx.restore()
          },
        ],
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
        ...series,
      ],
    }
  }

  function renderChart() {
    if (!container) return
    const width = container.clientWidth || 320
    containerWidth = width
    if (chart) {
      chart.destroy()
      chart = null
    }
    try {
      chart = new uPlot(buildOptions(width), data, container)
    } catch {
      // fallback if canvas is unavailable in test env
    }
  }

  onMount(() => {
    renderChart()
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

  onDestroy(() => {
    resizeObserver?.disconnect()
    chart?.destroy()
    chart = null
  })
</script>

<div
  data-testid="chart"
  class="relative rounded-[10px] border border-neutral-200 bg-white p-[12px]"
>
  <!-- Title on the left, compact series legend on the right -->
  <div class="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
    <div class="flex items-baseline gap-1.5">
      <h4 class="text-[12px] font-semibold text-neutral-800">{title}</h4>
      {#if subtitle}
        <span class="tnum text-[11px] text-neutral-400">{subtitle}</span>
      {/if}
    </div>

    <div class="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
      {#each series as s, i (s.label ?? i)}
        <span class="inline-flex items-center gap-1">
          {#if s.dash}
            <span
              class="inline-block h-0.5 w-2.5 border-b border-dashed"
              style="border-color: {seriesColor(s)};"
            ></span>
          {:else}
            <span
              class="inline-block h-2 w-2 rounded-[2px]"
              style="background-color: {seriesColor(s)};"
            ></span>
          {/if}
          <span>{s.label}</span>
        </span>
      {/each}
    </div>
  </div>

  <!-- Chart canvas container & compact cursor-following tooltip -->
  <div
    bind:this={container}
    onmouseleave={() => (hoverIdx = null)}
    role="img"
    aria-label={title}
    class="relative w-full overflow-hidden"
  >
    {#if hoverIdx !== null && hoverTimeStr}
      <div
        class="pointer-events-none absolute z-20 rounded-md border border-neutral-200 bg-white/95 px-2 py-1 text-[11px] shadow-xs backdrop-blur"
        style="top: 4px; {hoverLeft > containerWidth * 0.55
          ? `right: ${Math.max(4, Math.round(containerWidth - hoverLeft + 10))}px;`
          : `left: ${Math.max(4, Math.round(hoverLeft + 10))}px;`}"
      >
        <div class="tnum font-medium text-neutral-500">{hoverTimeStr}</div>
        {#each series as s, i (s.label ?? i)}
          <div class="tnum flex items-center justify-between gap-2 text-neutral-800">
            <span class="inline-flex items-center gap-1 text-neutral-600">
              <span
                class="inline-block h-1.5 w-1.5 rounded-full"
                style="background-color: {seriesColor(s)};"
              ></span>
              <span>{s.label}</span>
            </span>
            <span class="font-semibold">{formatHoverValue(s, hoverIdx, i)}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
