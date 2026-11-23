<script lang="ts">
  import { speed } from "@/lib/format"
  import ChartCard from "./ChartCard.svelte"
  import { api, type Node } from "@/lib/api"
  import { rangesFor, rangeLabel, metricCharts, pingCharts, probeSelection, toggleProbe, readProbes, saveProbes, type MetricsResponse } from "@/lib/detail-series"

  let { node, accent, historyDays, showPing }: { node: Node; accent: string; historyDays: number; showPing: boolean } = $props()

  let rangeHoursList = $derived(rangesFor(historyDays))
  let selectedHours = $state<number>(6)
  let showPeak = $state<boolean>(false)

  $effect(() => {
    if (!rangeHoursList.includes(selectedHours)) {
      selectedHours = rangeHoursList[0] ?? 24
    }
  })

  let chartContainerEl: HTMLDivElement | undefined = $state()
  let metricsResp = $state.raw<MetricsResponse | null>(null)
  let pingResp = $state.raw<MetricsResponse | null>(null)
  let metricError = $state("")
  let pingError = $state("")
  let updatedAtStr = $state("")
  let revision = $state(0)
  let nodeId = $derived(node.id)
  let resource = $derived(
    chartContainerEl && `/nodes/${nodeId}/metrics?hours=${selectedHours}&points=${Math.min(1440, Math.max(60, chartContainerEl.clientWidth))}`,
  )
  const message = (err: unknown) => (err instanceof Error ? err.message : "读取历史数据失败")

  $effect(() => {
    void revision
    let current = true
    metricsResp = null
    metricError = ""
    if (resource) {
      void api<MetricsResponse>(resource + "&series=metrics").then(
        (data) => {
          if (current) {
            metricsResp = data
            updatedAtStr = new Date().toLocaleTimeString("zh-CN", { hour12: false })
          }
        },
        (err) => { if (current) metricError = message(err) },
      )
    }
    return () => { current = false }
  })

  $effect(() => {
    void revision
    let current = true
    pingResp = null
    pingError = ""
    if (resource && showPing) {
      void api<MetricsResponse>(resource + "&series=ping").then(
        (data) => { if (current) pingResp = data },
        (err) => { if (current) pingError = message(err) },
      )
    }
    return () => { current = false }
  })

  let fetchError = $derived(metricError || pingError)
  let mem = $derived(node.metrics?.mem_total || node.mem_total)
  let disk = $derived(node.metrics?.disk_total || node.disk_total)
  let metrics = $derived(metricCharts(metricsResp, accent, showPeak, mem, disk))
  let ping = $derived(pingCharts(pingResp, accent))
  let saved = $state.raw(readProbes())
  let selection = $derived(probeSelection(ping.probes, saved))

  function choose(next: string[] | null) {
    saved = next
    saveProbes(next)
  }

  let tap = { name: "", time: 0 }
  function clickProbe(e: MouseEvent, name: string) {
    const touch = "pointerType" in e && e.pointerType === "touch"
    const twice = touch && tap.name === name && e.timeStamp - tap.time < 400
    tap = { name: touch && !twice ? name : "", time: e.timeStamp }
    choose(toggleProbe(selection.names, selection.active, name, e.altKey || twice || e.detail === 2))
  }
</script>

<div class="space-y-3" bind:this={chartContainerEl}>
  <div class="trend-toolbar flex flex-wrap items-center gap-2 text-[12px]">
    <div class="mr-auto">
      <h2 class="text-[14px] font-bold text-[var(--fg)]">资源趋势</h2>
      <p class="tnum text-[11px] text-[var(--fg-subtle)]">
        {showPeak ? "含区间峰值" : "历史平均值"}{updatedAtStr ? ` · 更新于 ${updatedAtStr}` : ""}
      </p>
    </div>

    <div class="scroll-hint range-scroll min-w-0 max-w-full overflow-x-auto" role="group" aria-label="时间范围">
      <div class="range-track flex w-max items-center gap-1 py-0.5">
        {#each rangeHoursList as h (h)}
          {@const active = selectedHours === h}
          <button
            type="button"
            data-testid="range-btn"
            aria-pressed={active}
            onclick={() => (selectedHours = h)}
            class="range-btn"
          >
            {rangeLabel(h)}
          </button>
        {/each}
      </div>
    </div>

    <div class="trend-actions flex items-center gap-2">
      <label class="desktop-peak inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-[var(--fg-muted)]">
        <input type="checkbox" bind:checked={showPeak} style:accent-color="var(--accent)" />
        <span>显示峰值</span>
      </label>

      <button
        type="button"
        class="mobile-peak trend-action btn"
        aria-label="显示峰值"
        title="显示峰值"
        aria-pressed={showPeak}
        onclick={() => (showPeak = !showPeak)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 18h18M3 14l5-6 4 4 5-8 4 6" />
        </svg>
      </button>

      <button type="button" aria-label="刷新" title="刷新" onclick={() => revision++} class="trend-action btn h-[28px]">
        <span class="refresh-text">刷新</span>
        <svg class="refresh-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20 10a8 8 0 1 0-1.8 7.2M20 4v6h-6" />
        </svg>
      </button>
    </div>
  </div>

  {#if fetchError}
    <div class="panel border-[var(--danger)] p-6 text-center text-[12px] text-[var(--danger-fg)]">
      读取历史数据失败：{fetchError}
    </div>
  {:else if !metricsResp && !pingResp}
    <div class="panel p-10 text-center text-[12px] text-[var(--fg-subtle)]">正在加载图表数据…</div>
  {:else}
    <div class="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
      {#each metrics.slice(0, 4) as spec (spec.title)}
        <ChartCard
          {...spec}
          subtitle={spec.title === "CPU 使用率" && node.metrics
            ? `${node.metrics.cpu.toFixed(1)}%`
            : spec.title === "网络速率" && node.metrics
              ? `↑ ${speed(node.metrics.net_tx)} ↓ ${speed(node.metrics.net_rx)}`
              : spec.subtitle}
        />
      {/each}
    </div>
    {#each metrics.slice(4) as spec (spec.title)}
      <ChartCard {...spec} />
    {/each}
    {#if showPing && ping.charts.length}
      <div class="grid gap-3" class:two={selection.hasLoss}>
        {#each ping.charts as spec, i (spec.title)}
          <div hidden={i === 1 && !selection.hasLoss} class="min-w-0">
            <ChartCard
              {...spec}
              show={selection.show}
              noLoss={i === 0 && selection.noLoss}
              controls={i === 0 && selection.names.length > 1 ? probeControls : undefined}
            />
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

{#snippet probeControls()}
  <div class="probe-controls" role="group" aria-label="选择探测节点">
    {#each ping.probes as p, i (p.id)}
      <button
        type="button"
        class="probe"
        data-testid="probe-chip"
        data-probe={p.name}
        aria-pressed={selection.show[i]}
        style:--probe={p.color}
        onclick={(e) => clickProbe(e, p.name)}
        ondblclick={() => choose([p.name])}
        title="Alt/⌥ 点击或双击仅看此探针"
      >
        <i aria-hidden="true"></i>{p.name} <span class="tnum">{p.avg == null ? "—" : `${p.avg}ms`}</span>
      </button>
    {/each}
    <button type="button" class="probe-all" data-testid="probe-all" disabled={selection.show.every(Boolean)} onclick={() => choose(null)}>全部</button>
  </div>
{/snippet}

<style>
  .range-btn {
    height: 28px;
    padding: 0 9px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--fg-muted);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background-color 120ms, border-color 120ms, color 120ms;
  }
  .range-btn:hover { background: var(--surface-hover); color: var(--fg); }
  .range-btn[aria-pressed="true"] {
    background: var(--accent-solid);
    border-color: transparent;
    color: var(--accent-solid-fg);
    font-weight: 600;
  }

  .probe-controls { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 6px 0 10px; }
  .probe-controls button { font-size: 12px; padding: 3px 9px; cursor: pointer; touch-action: manipulation; }
  button.probe {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface-subtle);
    color: var(--fg-subtle);
    transition: background-color 120ms, border-color 120ms, color 120ms;
  }
  .probe i { width: 7px; height: 7px; border-radius: 50%; background: var(--offline); }
  .probe[aria-pressed="true"] {
    color: var(--fg);
    border-color: color-mix(in srgb, var(--probe) 45%, var(--border));
    background: color-mix(in srgb, var(--probe) 10%, var(--surface));
  }
  .probe[aria-pressed="true"] i { background: var(--probe); }
  .probe-all { color: var(--fg-muted); text-decoration: underline; background: transparent; border: 0; }
  .probe-all:disabled { color: var(--fg-subtle); text-decoration: none; cursor: default; }

  @media (min-width: 1024px) { .two { grid-template-columns: 1fr 1fr; } }
  .mobile-peak, .refresh-icon { display: none; }

  @media (width < 640px) {
    .trend-toolbar { display: grid; grid-template-columns: minmax(0, 1fr) auto; }
    .trend-actions { grid-area: 1 / 2; }
    .range-scroll { grid-area: 2 / 1 / auto / -1; }
    .range-track button { min-width: 64px; min-height: 38px; padding-inline: 12px; }
    .desktop-peak, .refresh-text { display: none; }
    .refresh-icon { display: block; }
    .trend-action { display: inline-grid; place-items: center; width: 40px; height: 40px; padding: 0; }
    .mobile-peak[aria-pressed="true"] {
      color: var(--accent-solid-fg);
      background-color: var(--accent-solid);
      border-color: transparent;
    }
  }
</style>
