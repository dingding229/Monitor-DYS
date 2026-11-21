<script lang="ts">
  import { speed } from "@/lib/format"
  import ChartCard from "./ChartCard.svelte"
  import { api, type Node } from "@/lib/api"
  import { rangesFor, rangeLabel, metricCharts, pingCharts, type MetricsResponse } from "@/lib/detail-series"
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
  let metricsResp = $state.raw<MetricsResponse | null>(null), pingResp = $state.raw<MetricsResponse | null>(null)
  let metricError = $state(''), pingError = $state(''), updatedAtStr = $state(''), revision = $state(0)
  let nodeId = $derived(node.id)
  let resource = $derived(chartContainerEl && `/nodes/${nodeId}/metrics?hours=${selectedHours}&points=${Math.min(1440,Math.max(60,chartContainerEl.clientWidth))}`)
  const message = (err:unknown) => err instanceof Error ? err.message : '读取历史数据失败'
  // Keep requests independent: resolving show_ping must not re-fetch the metrics series.
  $effect(() => {
    void revision
    let current = true
    metricsResp = null; metricError = ''
    if(resource) void api<MetricsResponse>(resource+'&series=metrics').then(data => {
      if(current) { metricsResp=data; updatedAtStr=new Date().toLocaleTimeString('zh-CN',{hour12:false}) }
    }, err=>{ if(current) metricError=message(err) })
    return () => { current=false }
  })
  $effect(() => {
    void revision
    let current = true
    pingResp = null; pingError = ''
    if(resource && showPing) void api<MetricsResponse>(resource+'&series=ping').then(data => {
      if(current) pingResp=data
    }, err=>{ if(current) pingError=message(err) })
    return () => { current=false }
  })
  let fetchError = $derived(metricError || pingError)
  let mem = $derived(node.metrics?.mem_total || node.mem_total), disk = $derived(node.metrics?.disk_total || node.disk_total)
  let metrics = $derived(metricCharts(metricsResp, accent, showPeak, mem, disk))
  let ping = $derived(pingCharts(pingResp, accent))
</script>
  <!-- 5. Resource Trends Section: Range buttons + Show Peak checkbox + Refresh button + 4 side-by-side charts -->
  <div class="space-y-2.5" bind:this={chartContainerEl}>
    <div class="trend-toolbar flex flex-wrap items-center gap-2 text-[12px]">
      <div class="mr-auto">
        <h2 class="text-[14px] font-bold text-neutral-900">资源趋势</h2>
        <p class="tnum text-[11px] text-neutral-400">
          {showPeak ? "含区间峰值" : "历史平均值"}{updatedAtStr ? ` · 更新于 ${updatedAtStr}` : ""}
        </p>
      </div>

      <div class="scroll-hint range-scroll min-w-0 max-w-full overflow-x-auto" role="group" aria-label="时间范围">
        <div class="range-track flex w-max items-center gap-1 py-1">
          {#each rangeHoursList as h (h)}
            {@const active = selectedHours === h}
            <button
              type="button"
              data-testid="range-btn"
              aria-pressed={active}
              onclick={() => (selectedHours = h)}
              class="cursor-pointer rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors {active
                ? 'border-transparent text-white'
                : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'}"
              style={active ? "background-color: var(--accent);" : ""}
            >
              {rangeLabel(h)}
            </button>
          {/each}
        </div>
      </div>

      <div class="trend-actions flex items-center gap-2">
        <label class="desktop-peak inline-flex cursor-pointer items-center gap-1 text-[12px] text-neutral-600">
          <input
            type="checkbox"
            bind:checked={showPeak}
            class="rounded border-neutral-300"
          />
          <span>显示峰值</span>
        </label>

        <button type="button" class="mobile-peak trend-action" aria-label="显示峰值" title="显示峰值"
          aria-pressed={showPeak} onclick={() => (showPeak = !showPeak)}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18h18M3 14l5-6 4 4 5-8 4 6" /></svg>
        </button>

        <button
          type="button"
          aria-label="刷新" title="刷新"
          onclick={() => revision++}
          class="trend-action cursor-pointer rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[12px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          <span class="refresh-text">刷新</span>
          <svg class="refresh-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10a8 8 0 1 0-1.8 7.2M20 4v6h-6" /></svg>
        </button>
      </div>
    </div>

    {#if fetchError}
      <div class="panel rounded-[8px] border border-red-200 bg-white p-6 text-center text-[12px] text-red-600">
        读取历史数据失败：{fetchError}
      </div>
    {:else if !metricsResp && !pingResp}
      <div class="panel rounded-[8px] border border-neutral-200 bg-white p-10 text-center text-[12px] text-neutral-400">
        正在加载图表数据…
      </div>
    {:else}
      <div class="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
        {#each metrics.slice(0,4) as spec (spec.title)}<ChartCard {...spec} subtitle={spec.title === "CPU 使用率" && node.metrics ? `${node.metrics.cpu.toFixed(1)}%` : spec.title === "网络速率" && node.metrics ? `↓ ${speed(node.metrics.net_rx)} ↑ ${speed(node.metrics.net_tx)}` : spec.subtitle} hours={selectedHours} />{/each}
      </div>
      {#each metrics.slice(4) as spec (spec.title)}<ChartCard {...spec} hours={selectedHours} />{/each}
      {#if showPing && ping.length}
        <div class="grid gap-3" class:two={ping.length > 1}>
          {#each ping as spec (spec.title)}<ChartCard {...spec} hours={selectedHours} />{/each}
        </div>
      {/if}
    {/if}
  </div>
<style>
  @media(min-width:1024px){.two{grid-template-columns:1fr 1fr}}
  .mobile-peak, .refresh-icon { display: none; }

  @media (width < 640px) {
    .trend-toolbar { display: grid; grid-template-columns: minmax(0, 1fr) auto; }
    .trend-actions { grid-area: 1 / 2; }
    .range-scroll { grid-area: 2 / 1 / auto / -1; }
    .range-track button { min-width: 64px; min-height: 40px; padding-inline: 13px; white-space: nowrap; }
    .desktop-peak, .refresh-text { display: none; }
    .refresh-icon { display: block; }
    .trend-action {
      display: inline-grid; place-items: center; width: 44px; height: 44px; padding: 0;
      border: 1px solid var(--border); background-color: white; color: #475954; cursor: pointer;
    }
    .mobile-peak[aria-pressed="true"] { color: white; background-color: color-mix(in srgb, var(--accent) 58%, #082b21); }
  }
</style>
