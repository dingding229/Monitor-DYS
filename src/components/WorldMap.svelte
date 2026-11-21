<script lang="ts">
  import CountryFlag from "@/components/CountryFlag.svelte"
  import type { Node } from "@/lib/api"
  import { withAlpha } from "@/lib/color"
  import { regionName, speed } from "@/lib/format"
  import { countryCentroid, getWorldLandDots, projectGeo } from "@/lib/geo"

  let {
    nodes,
    accent = "#10b981",
    selectedCountry = $bindable<string | null>(null),
  }: {
    nodes: Node[]
    accent?: string
    selectedCountry?: string | null
  } = $props()

  const MAP_W = 360
  const MAP_H = 160
  // One round-capped path per country, rather than thousands of reactive circles.
  const land = new Map<string, string>()
  for (const { country, x, y } of getWorldLandDots(MAP_W, MAP_H)) {
    land.set(country, (land.get(country) ?? "") + `M${x} ${y}h0`)
  }

  type CountryGroup = {
    code: string
    name: string
    x: number
    y: number
    dispX: number
    dispY: number
    online: number
    total: number
    tx: number
    rx: number
    nodeNames: string[]
  }

  let onlineTotal = $derived(nodes.filter((n) => n.online).length)
  let offlineTotal = $derived(nodes.length - onlineTotal)

  let countryGroups = $derived.by<CountryGroup[]>(() => {
    const byCountry = new Map<
      string,
      { online: number; total: number; tx: number; rx: number; nodeNames: string[] }
    >()
    for (const n of nodes) {
      const code = (n.country || "").trim().toUpperCase()
      if (!code) continue
      const cur = byCountry.get(code) ?? { online: 0, total: 0, tx: 0, rx: 0, nodeNames: [] }
      cur.total++
      if (n.online) {
        cur.online++
        if (n.metrics) {
          cur.tx += n.metrics.net_tx
          cur.rx += n.metrics.net_rx
        }
      }
      cur.nodeNames.push(n.name)
      byCountry.set(code, cur)
    }

    const list: CountryGroup[] = []
    for (const [code, counts] of byCountry) {
      const centroid = countryCentroid(code) ?? [0, 20]
      const { x, y } = projectGeo(centroid[0], centroid[1], MAP_W, MAP_H)
      list.push({
        code,
        name: regionName(code),
        x,
        y,
        dispX: x,
        dispY: y,
        online: counts.online,
        total: counts.total,
        tx: counts.tx,
        rx: counts.rx,
        nodeNames: counts.nodeNames,
      })
    }

    // Sort by total node count descending, then by code
    list.sort((a, b) => b.total - a.total || a.code.localeCompare(b.code))

    // Collision avoidance for map badges (< 24px X, < 15px Y on 360x160 grid)
    const MIN_DX = 26
    const MIN_DY = 15
    for (let pass = 0; pass < 8; pass++) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i]
          const b = list[j]
          const dx = b.dispX - a.dispX
          const dy = b.dispY - a.dispY
          if (Math.abs(dx) < MIN_DX && Math.abs(dy) < MIN_DY) {
            const pushX = ((MIN_DX - Math.abs(dx)) / 2 + 0.6) * (dx >= 0 ? 1 : -1)
            const pushY = ((MIN_DY - Math.abs(dy)) / 2 + 0.6) * (dy >= 0 ? 1 : -1)
            if (Math.abs(dx) / MIN_DX > Math.abs(dy) / MIN_DY) {
              a.dispX = Math.max(18, Math.min(MAP_W - 18, a.dispX - pushX))
              b.dispX = Math.max(18, Math.min(MAP_W - 18, b.dispX + pushX))
            } else {
              a.dispY = Math.max(16, Math.min(MAP_H - 10, a.dispY - pushY))
              b.dispY = Math.max(16, Math.min(MAP_H - 10, b.dispY + pushY))
            }
          }
        }
      }
    }

    return list
  })

  let countByCode = $derived.by(() => {
    const map = new Map<string, number>()
    for (const c of countryGroups) {
      map.set(c.code, c.total)
    }
    return map
  })

  let maxCount = $derived(
    countryGroups.reduce((hi, c) => Math.max(hi, c.total), 1),
  )

  function dotFill(code: string): string {
    const count = countByCode.get(code)
    if (!count) return "#dde3e0"
    // Alpha deepens with node count (from 0.42 up to 0.92)
    const ratio = Math.min(1, count / Math.max(maxCount, 2))
    const alpha = 0.42 + ratio * 0.5
    return withAlpha(accent, alpha)
  }

  function badgeBg(c: CountryGroup): string {
    if (c.online === c.total) return "var(--accent)"
    if (c.online > 0) return "var(--warn)"
    return "var(--offline)"
  }

  function toggleCountry(code: string) {
    selectedCountry = selectedCountry === code ? null : code
  }

  let hovered = $state<CountryGroup | null>(null)
</script>

<div
  class="glass-overview map-card flex flex-col justify-between overflow-hidden rounded-[8px] border border-neutral-200 bg-white p-3"
>
  <!-- Top status header -->
  <div class="z-10 flex items-center justify-between gap-2">
    <div class="flex items-center gap-1.5">
      <span class="tnum inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/95 px-2.5 py-0.5 text-[12px] font-semibold text-neutral-800">
        <span class="h-2 w-2 rounded-full" style="background-color: var(--online);"></span>
        {onlineTotal} 在线
      </span>
      {#if offlineTotal > 0}
        <span class="tnum inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
          <span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
          {offlineTotal} 离线
        </span>
      {/if}
    </div>

    <span class="tnum rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] text-neutral-500">
      {countryGroups.length} 个国家和地区
    </span>
  </div>

  <!-- Map + Country List layout: side-by-side on wide screen, stacked on narrow, <520px only shows country-list -->
  <div class="mt-2 grid grid-cols-1 items-stretch gap-2.5 min-[1180px]:grid-cols-12">
    <!-- Left: SVG Dot-Matrix World Map (hidden below 520px per SPEC-v1.2 §7) -->
    <div
      data-testid="world-map"
      class="relative hidden h-[160px] min-[520px]:flex min-[1180px]:col-span-7 items-center justify-center"
    >
      <div class="relative aspect-[360/160] w-full max-w-[360px]">
        <svg
          viewBox="0 0 {MAP_W} {MAP_H}"
          class="h-full w-full select-none"
          aria-label="世界节点分布图"
        >
          <!-- Land dots colored by country node presence -->
          <g fill="none" stroke-linecap="round">
            {#each land as [country, path] (country)}
              <path d={path} stroke={dotFill(country)} stroke-width={countByCode.has(country) ? 1.9 : 1.5}/>
            {/each}
          </g>

          <!-- Leader lines & true centroid pin dots -->
          {#each countryGroups as m (m.code)}
            {#if Math.hypot(m.dispX - m.x, m.dispY - m.y) > 3}
              <line
                x1={m.x}
                y1={m.y}
                x2={m.dispX}
                y2={m.dispY}
                stroke="#64748b"
                stroke-width="0.75"
                stroke-dasharray="1.5 1.5"
              />
            {/if}
            <circle
              cx={m.x}
              cy={m.y}
              r="2"
              fill={badgeBg(m)}
              stroke="#ffffff"
              stroke-width="0.8"
            />
          {/each}
        </svg>

        <!-- Country markers (Circular count badge + Flag) -->
        <div class="pointer-events-none absolute inset-0">
          {#each countryGroups as m (m.code)}
            {@const leftPct = (m.dispX / MAP_W) * 100}
            {@const topPct = (m.dispY / MAP_H) * 100}
            {@const isSelected = selectedCountry === m.code}
            <button
              type="button"
              data-testid="map-country"
              data-country={m.code}
              data-count={m.total}
              aria-pressed={isSelected}
              title="{m.name} · 在线 {m.online}/{m.total}"
              onclick={() => toggleCountry(m.code)}
              onmouseenter={() => (hovered = m)}
              onmouseleave={() => {
                if (hovered?.code === m.code) hovered = null
              }}
              onfocus={() => (hovered = m)}
              onblur={() => {
                if (hovered?.code === m.code) hovered = null
              }}
              class="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 inline-flex cursor-pointer items-center gap-1 rounded-full bg-white/95 py-0.5 pr-1 pl-0.5 shadow-xs ring-1 transition-transform hover:z-20 hover:scale-110 {isSelected
                ? 'z-20 ring-2 ring-neutral-900'
                : 'ring-neutral-200'}"
              style="left: {leftPct.toFixed(1)}%; top: {topPct.toFixed(1)}%;"
            >
              <span
                class="tnum inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[9.5px] leading-none font-bold text-white"
                style="background-color: {badgeBg(m)};"
              >
                {m.total}
              </span>
              <CountryFlag code={m.code} />
            </button>
          {/each}
        </div>

        <!-- Hover Tooltip Overlay (pure text: country name, online/total, sum ↑↓ speeds, up to 6 node names + '等 N 台') -->
        {#if hovered}
          {@const shownNames = hovered.nodeNames.slice(0, 6)}
          {@const hasMore = hovered.nodeNames.length > 6}
          <div
            class="pointer-events-none absolute top-1 left-1 z-30 max-w-[230px] rounded-lg border border-neutral-200 bg-white/98 p-2 text-[11px] shadow-md backdrop-blur"
          >
            <div class="flex items-center justify-between gap-2 font-bold text-neutral-900">
              <span class="inline-flex items-center gap-1">
                <CountryFlag code={hovered.code} />
                <span>{hovered.name}</span>
              </span>
              <span class="tnum text-neutral-600">在线 {hovered.online}/{hovered.total}</span>
            </div>
            <div class="tnum mt-1 flex items-center gap-2 text-[10.5px]">
              <span class="text-emerald-600">↑ {speed(hovered.tx)}</span>
              <span class="text-sky-600">↓ {speed(hovered.rx)}</span>
            </div>
            <div class="mt-1 border-t border-neutral-100 pt-1 text-[10.5px] text-neutral-600">
              {shownNames.join("、")}{hasMore ? ` 等 ${hovered.nodeNames.length} 台` : ""}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Right / Bottom: Compact Country List sorted by node count descending (fixed height matching map, scrollable) -->
    <div
      data-testid="country-list"
      class="thin-scroll flex h-[160px] flex-col gap-1 overflow-y-auto pr-1 min-[1180px]:col-span-5"
    >
      {#if countryGroups.length === 0}
        <div class="py-6 text-center text-[12px] text-neutral-400">暂无地区数据</div>
      {:else}
        {#each countryGroups as c (c.code)}
          {@const isSelected = selectedCountry === c.code}
          <button
            type="button"
            data-testid="country-row"
            data-country={c.code}
            aria-pressed={isSelected}
            onclick={() => toggleCountry(c.code)}
            onmouseenter={() => (hovered = c)}
            onmouseleave={() => {
              if (hovered?.code === c.code) hovered = null
            }}
            class="flex w-full shrink-0 cursor-pointer items-center justify-between gap-1.5 rounded-md border px-2 py-1 text-left text-[11.5px] transition-colors {isSelected
              ? 'border-neutral-900 bg-neutral-900/5 font-semibold text-neutral-900'
              : 'border-transparent bg-neutral-50/80 text-neutral-700 hover:bg-neutral-100'}"
          >
            <span class="inline-flex min-w-0 items-center gap-1.5 truncate">
              <CountryFlag code={c.code} />
              <span class="truncate">{c.name}</span>
            </span>

            <span class="tnum flex shrink-0 items-center gap-1.5 text-[11px]">
              <span
                class="font-medium {c.online === c.total
                  ? 'text-neutral-700'
                  : c.online > 0
                    ? 'text-amber-600'
                    : 'text-neutral-400'}"
              >
                {c.online}/{c.total}
              </span>
              <span class="whitespace-nowrap text-right text-emerald-600" title="合计上行">
                ↑ {speed(c.tx)}
              </span>
              <span class="whitespace-nowrap text-right text-sky-600" title="合计下行">
                ↓ {speed(c.rx)}
              </span>
            </span>
          </button>
        {/each}
      {/if}
    </div>
  </div>
</div>
