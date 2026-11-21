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
  let currentTicksJson = $state<string>("[]")

  const pad2 = (n: number) => String(n).padStart(2, "0")
  const fmtHHMM = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  const fmtMMDD = (d: Date) => `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
  const isLocalMidnight = (d: Date) => d.getHours() === 0 && d.getMinutes() === 0

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

  function computeXAxisSplits(scaleMin: number, scaleMax: number, width: number, foundSpace?: number): number[] {
    const xs = (Array.isArray(data[0]) ? data[0] : []) as number[]
    if (xs.length === 1) {
      return [xs[0]]
    }
    if (!Number.isFinite(scaleMin) || !Number.isFinite(scaleMax) || scaleMax <= scaleMin) {
      return xs.length > 0 ? [xs[0]] : []
    }

    const spanSec = scaleMax - scaleMin
    const plotW = Math.max(120, width - 76)
    const maxTicks = Math.max(2, Math.min(10, Math.floor(plotW / Math.max(80, foundSpace || 96))))

    // Case 1: Actual data span > 24 hours -> align ticks to local midnight (00:00) with >= 1 day step
    if (spanSec > 86400) {
      const totalDays = Math.max(1, spanSec / 86400)
      const daySteps = [1, 2, 3, 5, 7, 10, 14, 15, 21, 30, 60, 90]
      const stepDays = daySteps.find((s) => totalDays / s <= maxTicks) ?? Math.ceil(totalDays / maxTicks)

      const first = new Date(scaleMin * 1000)
      first.setHours(0, 0, 0, 0)
      if (first.getTime() < scaleMin * 1000) {
        first.setDate(first.getDate() + 1)
      }

      const out: number[] = []
      const cur = new Date(first.getTime())
      while (cur.getTime() <= scaleMax * 1000) {
        out.push(Math.floor(cur.getTime() / 1000))
        cur.setDate(cur.getDate() + stepDays)
      }
      if (out.length >= 2) return out
      // If span is e.g. 25 hours and only 1 midnight fell inside, fall through to sub-day ticks including that midnight
    }

    // Case 2: Actual data span <= 24 hours (or only 1 midnight inside) -> nice sub-day ticks phased on local midnight
    const subDaySteps = [60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 14400, 21600, 43200]
    const stepSec = subDaySteps.find((s) => spanSec / s <= maxTicks) ?? 43200
    const tzOffsetSec = new Date(scaleMin * 1000).getTimezoneOffset() * 60

    const firstTick = Math.ceil((scaleMin - tzOffsetSec) / stepSec) * stepSec + tzOffsetSec
    const out: number[] = []
    for (let t = firstTick; t <= scaleMax; t += stepSec) {
      out.push(t)
    }

    // Ensure if a local midnight lies within [scaleMin, scaleMax], it is included in splits
    const mid = new Date(scaleMin * 1000)
    mid.setHours(0, 0, 0, 0)
    if (mid.getTime() < scaleMin * 1000) {
      mid.setDate(mid.getDate() + 1)
    }
    const midSec = Math.floor(mid.getTime() / 1000)
    if (midSec >= scaleMin && midSec <= scaleMax && !out.includes(midSec)) {
      out.push(midSec)
      out.sort((a, b) => a - b)
    }

    if (out.length < 2) {
      return scaleMax > scaleMin ? [Math.ceil(scaleMin), Math.floor(scaleMax)] : [Math.round(scaleMin)]
    }
    return out
  }

  function formatXAxisValues(splits: number[]): string[] {
    if (!splits.length) return []
    const xs = (Array.isArray(data[0]) ? data[0] : []) as number[]
    if (xs.length === 1 || splits.length === 1) {
      const d = new Date((splits[0] ?? xs[0]) * 1000)
      return [`${fmtMMDD(d)} ${fmtHHMM(d)}`]
    }

    const dates = splits.map((s) => new Date(s * 1000))
    const spanSec = xs.length > 1 ? xs[xs.length - 1] - xs[0] : splits[splits.length - 1] - splits[0]

    let rawLabels: string[]
    if (spanSec > 86400) {
      rawLabels = dates.map((d) => (isLocalMidnight(d) ? fmtMMDD(d) : fmtHHMM(d)))
    } else {
      rawLabels = dates.map((d) => (isLocalMidnight(d) ? fmtMMDD(d) : fmtHHMM(d)))
    }

    const seen = new Set<string>()
    return rawLabels.map((lbl) => {
      if (!lbl || seen.has(lbl)) return ""
      seen.add(lbl)
      return lbl
    })
  }

  function syncDataTicks(labels: string[]) {
    const nonEmpty = labels.filter(Boolean)
    const json = JSON.stringify(nonEmpty)
    currentTicksJson = json
    container?.setAttribute("data-ticks", json)
    canvasHost?.setAttribute("data-ticks", json)
  }

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
          splits: (_u, _axisIdx, scaleMin, scaleMax, _foundIncr, foundSpace) =>
            computeXAxisSplits(scaleMin, scaleMax, width, foundSpace),
          values: (_u, splits) => {
            const formatted = formatXAxisValues(splits)
            syncDataTicks(formatted)
            return formatted
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
    // Pre-compute ticks in case canvas is stubbed in unit/jsdom tests
    const xs = (Array.isArray(data[0]) ? data[0] : []) as number[]
    if (xs.length > 0) {
      const prelimSplits = computeXAxisSplits(xs[0], xs[xs.length - 1], width, 56)
      syncDataTicks(formatXAxisValues(prelimSplits))
    } else {
      syncDataTicks([])
    }
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
  data-ticks={currentTicksJson}
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
