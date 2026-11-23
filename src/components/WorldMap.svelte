<script lang="ts">
  import CountryFlag from "@/components/CountryFlag.svelte"
  import type { Node } from "@/lib/api"
  import { withAlpha } from "@/lib/color"
  import { regionName, speed } from "@/lib/format"
  import { countryCentroid, getWorldLandDots, projectGeo } from "@/lib/geo"
  import { createCountryView, type CountryCounts } from "@/lib/home-view.svelte"

  let {
    nodes,
    accent = "#10b981",
    selectedCountry = null,
    onSelectCountry,
  }: {
    nodes: readonly Node[]
    accent?: string
    selectedCountry?: string | null
    onSelectCountry: (code: string | null) => void
  } = $props()

  let mapEl: HTMLElement | undefined = $state()
  let hovered = $state<CountryGroup | null>(null)
  const countryView = createCountryView(
    () => nodes,
    () => Boolean(hovered || mapEl?.matches(":hover")),
  )

  const MAP_W = 360
  const MAP_H = 160
  const land = new Map<string, string>()
  for (const { country, x, y } of getWorldLandDots(MAP_W, MAP_H)) {
    land.set(country, (land.get(country) ?? "") + `M${x} ${y}h0`)
  }

  type CountryGroup = CountryCounts & {
    name: string
    x: number
    y: number
    dispX: number
    dispY: number
  }

  let countryGroups = $derived.by<CountryGroup[]>(() => {
    const list: CountryGroup[] = countryView.aggregate.countries.map((c) => {
      const centroid = countryCentroid(c.code) ?? [0, 20]
      const { x, y } = projectGeo(centroid[0], centroid[1], MAP_W, MAP_H)
      return { ...c, name: regionName(c.code), x, y, dispX: x, dispY: y }
    })

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

  let countByCode = $derived(new Map(countryGroups.map((c) => [c.code, c.total])))
  let maxCount = $derived(countryGroups.reduce((hi, c) => Math.max(hi, c.total), 1))

  function dotFill(code: string): string {
    const count = countByCode.get(code)
    if (!count) return "var(--border)"
    const ratio = Math.min(1, count / Math.max(maxCount, 2))
    return withAlpha(accent, 0.42 + ratio * 0.5)
  }

  function badgeBg(c: CountryGroup): string {
    return c.online === c.total ? "var(--accent)" : c.online > 0 ? "var(--warn)" : "var(--offline)"
  }

  function toggleCountry(code: string) {
    onSelectCountry(selectedCountry === code ? null : code)
  }
</script>

<div bind:this={mapEl} class="panel flex flex-col justify-between overflow-hidden p-3">
  <div class="z-10 flex items-center justify-between gap-2">
    <div class="flex items-center gap-1.5">
      <span class="badge-online tnum">
        <span class="h-1.5 w-1.5 rounded-full" style:background-color="var(--online)"></span>
        {countryView.aggregate.online} 在线
      </span>
      {#if countryView.aggregate.offline > 0}
        <span class="tnum inline-flex items-center gap-1 rounded-full bg-[var(--warn-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--warn-fg)]">
          <span class="h-1.5 w-1.5 rounded-full" style:background-color="var(--warn)"></span>
          {countryView.aggregate.offline} 离线
        </span>
      {/if}
    </div>

    <span class="tnum rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-0.5 text-[11px] text-[var(--fg-muted)]">
      {countryGroups.length} 个国家和地区
    </span>
  </div>

  <div class="mt-2 grid grid-cols-1 items-stretch gap-2.5 min-[1180px]:grid-cols-12">
    <div
      data-testid="world-map"
      class="relative hidden h-[160px] items-center justify-center min-[520px]:flex min-[1180px]:col-span-7"
    >
      <div class="relative aspect-[360/160] w-full max-w-[360px]">
        <svg viewBox="0 0 {MAP_W} {MAP_H}" class="h-full w-full select-none" aria-label="世界节点分布图">
          <g fill="none" stroke-linecap="round">
            {#each land as [country, path] (country)}
              <path d={path} stroke={dotFill(country)} stroke-width={countByCode.has(country) ? 1.9 : 1.5} />
            {/each}
          </g>

          {#each countryGroups as m (m.code)}
            {#if Math.hypot(m.dispX - m.x, m.dispY - m.y) > 3}
              <line x1={m.x} y1={m.y} x2={m.dispX} y2={m.dispY} stroke="var(--fg-subtle)" stroke-width="0.75" stroke-dasharray="1.5 1.5" />
            {/if}
            <circle cx={m.x} cy={m.y} r="2" fill={badgeBg(m)} stroke="var(--surface)" stroke-width="0.8" />
          {/each}
        </svg>

        <div class="pointer-events-none absolute inset-0">
          {#each countryGroups as m (m.code)}
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
              onmouseleave={() => { if (hovered?.code === m.code) hovered = null }}
              onfocus={() => (hovered = m)}
              onblur={() => { if (hovered?.code === m.code) hovered = null }}
              class="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 inline-flex cursor-pointer items-center gap-1 rounded-full border bg-[var(--surface)] py-0.5 pr-1 pl-0.5 transition-colors hover:z-20 hover:border-[var(--border-strong)] {isSelected ? 'z-20 border-[var(--accent)]' : 'border-[var(--border)]'}"
              style="left: {((m.dispX / MAP_W) * 100).toFixed(1)}%; top: {((m.dispY / MAP_H) * 100).toFixed(1)}%;"
            >
              <span
                class="tnum inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[9.5px] leading-none font-bold text-white"
                style:background-color={badgeBg(m)}
              >
                {m.total}
              </span>
              <CountryFlag code={m.code} />
            </button>
          {/each}
        </div>

        {#if hovered}
          {@const shownNames = hovered.nodeNames.slice(0, 6)}
          <div class="pointer-events-none absolute top-1 left-1 z-30 max-w-[230px] rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-2 text-[11px]">
            <div class="flex items-center justify-between gap-2 font-bold text-[var(--fg)]">
              <span class="inline-flex items-center gap-1">
                <CountryFlag code={hovered.code} />
                <span>{hovered.name}</span>
              </span>
              <span class="tnum text-[var(--fg-muted)]">在线 {hovered.online}/{hovered.total}</span>
            </div>
            <div class="tnum mt-1 flex items-center gap-2 text-[10.5px]">
              <span class="tx">↑ {speed(hovered.tx)}</span>
              <span class="rx">↓ {speed(hovered.rx)}</span>
            </div>
            <div class="mt-1 border-t border-[var(--border-subtle)] pt-1 text-[10.5px] text-[var(--fg-muted)]">
              {shownNames.join("、")}{hovered.nodeNames.length > 6 ? ` 等 ${hovered.nodeNames.length} 台` : ""}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <div data-testid="country-list" class="thin-scroll flex h-[160px] flex-col gap-1 overflow-y-auto pr-1 min-[1180px]:col-span-5">
      {#if countryGroups.length === 0}
        <div class="py-6 text-center text-[12px] text-[var(--fg-subtle)]">暂无地区数据</div>
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
            onmouseleave={() => { if (hovered?.code === c.code) hovered = null }}
            class="flex w-full shrink-0 cursor-pointer items-center justify-between gap-1.5 rounded-[6px] border px-2 py-1 text-left text-[12px] transition-colors {isSelected
              ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] font-semibold text-[var(--fg)]'
              : 'border-transparent bg-[var(--surface-subtle)] text-[var(--fg-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]'}"
          >
            <span class="inline-flex min-w-0 items-center gap-1.5 truncate">
              <CountryFlag code={c.code} />
              <span class="truncate">{c.name}</span>
            </span>

            <span class="tnum flex shrink-0 items-center gap-1.5 text-[11px]">
              <span class={c.online === c.total ? "font-medium text-[var(--fg)]" : c.online > 0 ? "font-medium text-[var(--warn-fg)]" : "text-[var(--fg-subtle)]"}>
                {c.online}/{c.total}
              </span>
              <span class="tx whitespace-nowrap text-right" title="合计上行">↑ {speed(c.tx)}</span>
              <span class="rx whitespace-nowrap text-right" title="合计下行">↓ {speed(c.rx)}</span>
            </span>
          </button>
        {/each}
      {/if}
    </div>
  </div>
</div>
