<script lang="ts">
  import type { Node } from "@/lib/api"
  import type { summarizeNodes } from "@/lib/home-view.svelte"
  import { bytes, speed } from "@/lib/format"

  let {
    summary,
    mapNodes,
    accent,
    loading,
    showSummary,
    showMap,
    selectedCountry = null,
    onSelectCountry,
  }: {
    summary: ReturnType<typeof summarizeNodes>
    mapNodes: readonly Node[]
    accent: string
    loading: boolean
    showSummary: boolean
    showMap: boolean
    selectedCountry?: string | null
    onSelectCountry: (code: string | null) => void
  } = $props()

  let mapModule = $derived(showMap ? import("./WorldMap.svelte") : null)

  let tiles = $derived([
    { label: "服务器", value: `${summary.online} / ${summary.total}`, note: `${summary.offline ? `${summary.offline} 离线` : "全部在线"} · ${summary.countries.size} 个地区`, id: "summary-servers", icon: "M2 2.5h12v4.5H2zM2 9h12v4.5H2zM4.5 4.75h.5M4.5 11.25h.5" },
    { label: "实时上行", value: speed(summary.tx), note: `本月上行 ${bytes(summary.month_tx)}`, icon: "M8 13V3M4.5 6.5 8 3l3.5 3.5" },
    { label: "实时下行", value: speed(summary.rx), note: `本月下行 ${bytes(summary.month_rx)}`, icon: "M8 3v10M4.5 9.5 8 13l3.5-3.5" },
    { label: "累计流量", value: bytes(summary.month_tx + summary.month_rx), note: `历史总计 ${bytes(summary.total_tx + summary.total_rx)}`, icon: "M2.5 13h11M4.5 10.5V7.5M8 10.5V3.5M11.5 10.5V6" },
    { label: "累计上行", value: bytes(summary.total_tx), note: summary.day_tx === null ? "" : `今日上行 ${bytes(summary.day_tx)}`, id: "summary-total-up", icon: "M2.5 10.5v2.5h11v-2.5M8 9.5V2.5M5 5.5 8 2.5l3 3" },
    { label: "累计下行", value: bytes(summary.total_rx), note: summary.day_rx === null ? "" : `今日下行 ${bytes(summary.day_rx)}`, id: "summary-total-down", icon: "M2.5 10.5v2.5h11v-2.5M8 2.5v7M5 6.5l3 3 3-3" },
  ])
</script>

{#if showSummary || showMap}
  <section data-testid="summary" aria-label="节点总览" class="overview" class:split={showSummary && showMap}>
    {#if showSummary}
      <div class="tiles">
        {#each tiles as tile (tile.label)}
          <div class="panel tile" data-testid="summary-tile">
            <div data-testid={tile.id}>
              <div class="tile-label">
                <span>{tile.label}</span>
                <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">
                  <path d={tile.icon} />
                </svg>
              </div>
              {#if loading}
                <div class="bone mt-2 h-6 w-2/3"></div>
              {:else}
                {@const parts = tile.value.split(" ")}
                <div class="tile-value tnum">{parts[0]}<small>{" " + parts.slice(1).join(" ")}</small></div>
              {/if}
              <div class="tile-note tnum" title={tile.note}>{loading ? "" : tile.note}</div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    {#if mapModule}
      {#snippet placeholder()}
        <div class="panel map-placeholder" aria-label="加载地区分布"><span class="bone block h-4 w-1/4"></span></div>
      {/snippet}
      {#await mapModule}
        {@render placeholder()}
      {:then { default: WorldMap }}
        {#if loading}
          {@render placeholder()}
        {:else}
          <WorldMap nodes={mapNodes} {accent} {selectedCountry} {onSelectCountry} />
        {/if}
      {:catch}
        <div class="panel p-4 text-[12px] text-[var(--fg-muted)]">地图加载失败，请刷新重试。</div>
      {/await}
    {/if}
  </section>
{/if}
