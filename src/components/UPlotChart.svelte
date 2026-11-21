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
    hours = 6,
  }: {
    title: string
    subtitle?: string
    data: uPlot.AlignedData
    series: uPlot.Series[]
    yFormat?: (v: number) => string
    yMin?: number
    yMax?: number
    height?: number
    hours?: number
  } = $props()

  let container: HTMLDivElement | undefined = $state()
  let canvasHost: HTMLDivElement | undefined = $state()
  let chart: uPlot | null = null
  let resizeObserver: ResizeObserver | null = null

  let hoverIdx = $state<number | null>(null)
  let hoverLeft = $state<number>(0)
  let containerWidth = $state<number>(320)

  const pad2 = (n: number) => String(n).padStart(2, "0")
  const fmtHHMM = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  const fmtMMDD = (d: Date) => `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

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
    const axisColor = "#737373"
    const gridColor = "rgba(0,0,0,0.05)"
    const pointCount = Array.isArray(data[0]) ? data[0].length : 0
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
          size: 22,
          gap: 3,
          font: "11px -apple-system, BlinkMacSystemFont, sans-serif",
          // Per SPEC-v1.2 §6.d:
          // - hours > 24: show date `MM-DD`
          // - hours <= 24: show `HH:mm`, and when crossing day boundary show `MM-DD HH:mm` on the first tick
          values: (_u, splits) => {
            if (!splits.length) return []
            const dates = splits.map((s) => new Date(s * 1000))
            if (hours > 24) {
              return dates.map(fmtMMDD)
            }
            const firstDay = dates[0].getDate()
            const lastDay = dates[dates.length - 1].getDate()
            const crossesDay = firstDay !== lastDay || dates[0].getMonth() !== dates[dates.length - 1].getMonth()
            return dates.map((d, idx) => {
              if (crossesDay && idx === 0) {
                return `${fmtMMDD(d)} ${fmtHHMM(d)}`
              }
              return fmtHHMM(d)
            })
          },
        },
        {
          stroke: axisColor,
          grid: { stroke: gridColor, width: 1 },
          ticks: { stroke: gridColor, width: 1, size: 3 },
          size: 52,
          gap: 4,
          font: "11px -apple-system, BlinkMacSystemFont, sans-serif",
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
    if (chart) {
      chart.destroy()
      chart = null
    }
    canvasHost.replaceChildren()
    try {
      chart = new uPlot(buildOptions(width), data, canvasHost)
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
    void hours
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
    style="height: {height}px;"
    class="relative w-full overflow-hidden"
  >
    <div bind:this={canvasHost} class="h-full w-full"></div>
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
