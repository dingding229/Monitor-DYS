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
    height = 165,
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

  const HHMM = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" })
  const MDHHMM = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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
        show: true,
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
          size: 54,
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
      },
      series: [
        {
          label: "时间",
          value: (_u, ts) => (ts ? new Date(ts * 1000).toLocaleString("zh-CN") : "—"),
        },
        ...series,
      ],
    }
  }

  function renderChart() {
    if (!container) return
    const width = container.clientWidth || 320
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
  class="rounded-[10px] border border-neutral-200 bg-white p-[12px]"
>
  <div class="mb-1.5 flex flex-wrap items-baseline justify-between gap-1.5">
    <h4 class="text-[12px] font-semibold text-neutral-800">{title}</h4>
    {#if subtitle}
      <span class="tnum text-[11px] text-neutral-500">{subtitle}</span>
    {/if}
  </div>
  <div bind:this={container} class="w-full overflow-hidden"></div>
</div>
