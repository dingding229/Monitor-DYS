<script lang="ts">
  import type { Node } from "@/lib/api"
  import { bytes, speed } from "@/lib/format"

  let { nodes, mapNodes, accent, loading, showSummary, showMap, selectedCountry = $bindable(null) }: {
    nodes: Node[]; mapNodes: Node[]; accent: string; loading: boolean; showSummary: boolean; showMap: boolean; selectedCountry?: string | null
  } = $props()
  let mapModule = $derived(showMap ? import("./WorldMap.svelte") : null)
  let totals = $derived.by(() => {
    const t = { online: 0, countries: new Set<string>(), tx: 0, rx: 0, month_tx: 0, month_rx: 0, total_tx: 0, total_rx: 0, day_tx: null as number | null, day_rx: null as number | null }
    for (const n of nodes) {
      if (n.country?.trim()) t.countries.add(n.country.trim().toUpperCase())
      if (n.online) { t.online++; t.tx += n.metrics?.net_tx ?? 0; t.rx += n.metrics?.net_rx ?? 0 }
      for (const key of ['month_tx', 'month_rx', 'total_tx', 'total_rx'] as const) {
        const value = n[key] ?? n.metrics?.[key]; if (Number.isFinite(value)) t[key] += value
      }
      for (const key of ['day_tx', 'day_rx'] as const) if (Number.isFinite(n[key])) t[key] = (t[key] ?? 0) + n[key]
    }
    return t
  })
  let offline = $derived(nodes.length - totals.online)
  let tiles = $derived([
    { label: '服务器', value: `${totals.online} / ${nodes.length}`, note: `${offline ? `${offline} 离线` : '全部在线'} · ${totals.countries.size} 个地区`, id: 'summary-servers', icon: 'M3 4h14v5H3zM3 12h14v5H3zM6 6.5h1M6 14.5h1' },
    { label: '实时上行', value: speed(totals.tx), note: `本月上行 ${bytes(totals.month_tx)}`, icon: 'M10 16V4m-5 5 5-5 5 5' },
    { label: '实时下行', value: speed(totals.rx), note: `本月下行 ${bytes(totals.month_rx)}`, icon: 'M10 4v12m-5-5 5 5 5-5' },
    { label: '累计流量', value: bytes(totals.month_tx + totals.month_rx), note: `历史总计 ${bytes(totals.total_tx + totals.total_rx)}`, icon: 'M3 16h14M5 13V9m5 4V4m5 9V7' },
    { label: '累计上行', value: bytes(totals.total_tx), note: totals.day_tx === null ? '' : `今日上行 ${bytes(totals.day_tx)}`, id: 'summary-total-up', icon: 'M3 13v3h14v-3M10 12V3M6 7l4-4 4 4' },
    { label: '累计下行', value: bytes(totals.total_rx), note: totals.day_rx === null ? '' : `今日下行 ${bytes(totals.day_rx)}`, id: 'summary-total-down', icon: 'M3 13v3h14v-3M10 3v9m-4-4 4 4 4-4' },
  ])
</script>

{#if showSummary || showMap}
  <section data-testid="summary" aria-label="节点总览" class="overview" class:split={showSummary && showMap}>
    {#if showSummary}
      <div class="tiles">
        {#each tiles as tile (tile.label)}
          <div class="glass-overview tile" data-testid="summary-tile">
            <div data-testid={tile.id}>
              <div class="tile-label">{tile.label}<svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d={tile.icon}/></svg></div>
              {#if loading}<div class="bone mt-2 h-6 w-2/3"></div>
              {:else}<div class="tile-value tnum">{tile.value.split(' ')[0]}<small>{' ' + tile.value.split(' ').slice(1).join(' ')}</small></div>{/if}
              <div class="tile-note tnum" title={tile.note}>{loading ? '' : tile.note}</div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
    {#if mapModule}
      {#snippet placeholder()}
        <div class="glass-overview map-placeholder" aria-label="加载地区分布"><span class="bone block h-4 w-1/4"></span></div>
      {/snippet}
      {#await mapModule}{@render placeholder()}
      {:then { default: WorldMap }}
        {#if loading}{@render placeholder()}{:else}<WorldMap nodes={mapNodes} {accent} bind:selectedCountry />{/if}
      {:catch}<div class="glass-overview p-4">地图加载失败，请刷新重试。</div>{/await}
    {/if}
  </section>
{/if}
