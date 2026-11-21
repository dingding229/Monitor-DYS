<script lang="ts">
  import CountryFlag from "@/components/CountryFlag.svelte"
  import type { Node } from "@/lib/api"
  import { countryCentroid, countryName, getWorldLandDots, projectGeo } from "@/lib/geo"

  let { nodes }: { nodes: Node[] } = $props()

  const MAP_W = 360
  const MAP_H = 160
  const landDots = getWorldLandDots(MAP_W, MAP_H)

  type CountryGroup = {
    code: string
    name: string
    x: number
    y: number
    online: number
    total: number
  }

  let onlineTotal = $derived(nodes.filter((n) => n.online).length)
  let offlineTotal = $derived(nodes.length - onlineTotal)

  let markers = $derived.by<CountryGroup[]>(() => {
    const byCountry = new Map<string, { online: number; total: number }>()
    for (const n of nodes) {
      const code = (n.country || "").trim().toUpperCase()
      if (!code) continue
      const cur = byCountry.get(code) ?? { online: 0, total: 0 }
      cur.total++
      if (n.online) cur.online++
      byCountry.set(code, cur)
    }

    const list: CountryGroup[] = []
    for (const [code, counts] of byCountry) {
      const centroid = countryCentroid(code)
      if (!centroid) continue
      const { x, y } = projectGeo(centroid[0], centroid[1], MAP_W, MAP_H)
      list.push({
        code,
        name: countryName(code),
        x,
        y,
        online: counts.online,
        total: counts.total,
      })
    }
    return list
  })

  let hovered = $state<CountryGroup | null>(null)
</script>

<div
  data-testid="world-map"
  class="relative hidden min-[520px]:flex flex-col justify-between overflow-hidden rounded-[10px] border border-neutral-200 bg-white p-3"
>
  <!-- Top-left status badges -->
  <div class="z-10 flex items-center justify-between gap-2">
    <div class="flex items-center gap-1.5">
      <span class="tnum inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/90 px-2.5 py-0.5 text-[12px] font-semibold text-neutral-800">
        <span class="h-2 w-2 rounded-full" style="background-color: var(--online);"></span>
        {onlineTotal}
      </span>
      {#if offlineTotal > 0}
        <span class="tnum inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
          <span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
          {offlineTotal} 离线
        </span>
      {/if}
    </div>

    {#if hovered}
      <div class="tnum rounded-full border border-neutral-200 bg-white/95 px-2.5 py-0.5 text-[11px] font-medium text-neutral-700">
        {hovered.name} · 在线 {hovered.online}/{hovered.total}
      </div>
    {:else if markers.length > 0}
      <span class="tnum rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] text-neutral-500">
        {markers.length} 个国家和地区
      </span>
    {/if}
  </div>

  <!-- SVG dot matrix & markers -->
  <div class="relative my-1 flex-1">
    <svg
      viewBox="0 0 {MAP_W} {MAP_H}"
      class="h-full max-h-[168px] w-full select-none"
      aria-label="世界节点分布图"
    >
      <g fill="#d1dbd6">
        {#each landDots as dot (`${dot.x},${dot.y}`)}
          <circle cx={dot.x} cy={dot.y} r="1.45" />
        {/each}
      </g>

      {#each markers as m (m.code)}
        <g transform="translate({m.x}, {m.y})">
          <circle
            r="6"
            fill={m.online === m.total ? "var(--online)" : "var(--warn)"}
            fill-opacity="0.18"
          />
          <circle
            r="2.6"
            fill={m.online === m.total ? "var(--online)" : "var(--warn)"}
            stroke="#ffffff"
            stroke-width="1"
          />
        </g>
      {/each}
    </svg>

    <!-- Interactive HTML Flag badges positioned over centroids -->
    <div class="pointer-events-none absolute inset-0">
      {#each markers as m (m.code)}
        {@const leftPct = (m.x / MAP_W) * 100}
        {@const topPct = (m.y / MAP_H) * 100}
        <button
          type="button"
          data-testid="map-marker"
          title="{m.name} · 在线 {m.online}/{m.total}"
          onmouseenter={() => (hovered = m)}
          onmouseleave={() => {
            if (hovered?.code === m.code) hovered = null
          }}
          onfocus={() => (hovered = m)}
          onblur={() => {
            if (hovered?.code === m.code) hovered = null
          }}
          class="pointer-events-auto absolute -translate-x-1/2 -translate-y-full cursor-pointer rounded bg-white/95 p-0.5 shadow-2xs ring-1 ring-neutral-200 transition-transform hover:z-20 hover:scale-110"
          style="left: {leftPct.toFixed(1)}%; top: {Math.max(12, topPct - 2).toFixed(1)}%;"
        >
          <CountryFlag code={m.code} />
        </button>
      {/each}
    </div>
  </div>
</div>
