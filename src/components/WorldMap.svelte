<script lang="ts">
  import CountryFlag from "@/components/CountryFlag.svelte"
  import type { Node } from "@/lib/api"
  import { withAlpha } from "@/lib/color"
  import { regionName, speed } from "@/lib/format"
  import { countryCentroid, getWorldLandDots, projectGeo } from "@/lib/geo"
  import { createCountryView, type CountryCounts } from "@/lib/home-view.svelte"

  let { nodes, accent = "#10b981", selectedCountry = null, onSelectCountry }: {
    nodes: readonly Node[]
    accent?: string
    selectedCountry?: string | null
    onSelectCountry: (code: string | null) => void
  } = $props()

  let mapEl: HTMLElement | undefined = $state()
  let hovered = $state<CountryGroup | null>(null)
  const countryView = createCountryView(() => nodes, () => Boolean(hovered || mapEl?.matches(":hover")))

  const MAP_W = 360
  const MAP_H = 160
  const land = new Map<string, string>()
  for (const { country, x, y } of getWorldLandDots(MAP_W, MAP_H)) {
    land.set(country, (land.get(country) ?? "") + `M${x} ${y}h0`)
  }

  type CountryGroup = CountryCounts & { name: string; x: number; y: number; dispX: number; dispY: number }

  let countryGroups = $derived.by<CountryGroup[]>(() => {
    const list: CountryGroup[] = countryView.aggregate.countries.map((c) => {
      const centroid = countryCentroid(c.code) ?? [0, 20]
      const { x, y } = projectGeo(centroid[0], centroid[1], MAP_W, MAP_H)
      return { ...c, name: regionName(c.code), x, y, dispX: x, dispY: y }
    })

    const MIN_DX = 26, MIN_DY = 15
    for (let pass = 0; pass < 8; pass++) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i], b = list[j]
          const dx = b.dispX - a.dispX, dy = b.dispY - a.dispY
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
    return withAlpha(accent, 0.42 + Math.min(1, count / Math.max(maxCount, 2)) * 0.5)
  }
  function badgeBg(c: CountryGroup): string {
    return c.online === c.total ? "var(--accent)" : c.online > 0 ? "var(--warn)" : "var(--offline)"
  }
  function toggleCountry(code: string) {
    onSelectCountry(selectedCountry === code ? null : code)
  }
</script>

<div bind:this={mapEl} class="panel wm-card">
  <div class="wm-head">
    <div class="wm-pills">
      <span class="badge-online tnum">
        <i class="status-dot" style="width:6px;height:6px;background:var(--online)"></i>
        {countryView.aggregate.online} 在线
      </span>
      {#if countryView.aggregate.offline > 0}
        <span class="wm-off tnum">
          <i class="status-dot" style="width:6px;height:6px;background:var(--warn)"></i>
          {countryView.aggregate.offline} 离线
        </span>
      {/if}
    </div>
    <span class="wm-cnt tnum">{countryGroups.length} 个国家和地区</span>
  </div>

  <div class="wm-body">
    <div data-testid="world-map" class="wm-stage">
      <div class="wm-aspect">
        <svg viewBox="0 0 {MAP_W} {MAP_H}" class="wm-svg" aria-label="世界节点分布图">
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

        <div class="wm-pins">
          {#each countryGroups as m (m.code)}
            <button
              type="button"
              data-testid="map-country"
              data-country={m.code}
              data-count={m.total}
              aria-pressed={selectedCountry === m.code}
              title="{m.name} · 在线 {m.online}/{m.total}"
              onclick={() => toggleCountry(m.code)}
              onmouseenter={() => (hovered = m)}
              onmouseleave={() => { if (hovered?.code === m.code) hovered = null }}
              onfocus={() => (hovered = m)}
              onblur={() => { if (hovered?.code === m.code) hovered = null }}
              class="wm-pin"
              class:sel={selectedCountry === m.code}
              style="left:{((m.dispX / MAP_W) * 100).toFixed(1)}%;top:{((m.dispY / MAP_H) * 100).toFixed(1)}%"
            >
              <span class="wm-pin-n tnum" style:background={badgeBg(m)}>{m.total}</span>
              <CountryFlag code={m.code} />
            </button>
          {/each}
        </div>

        {#if hovered}
          <div class="wm-tip">
            <div class="wm-tip-h">
              <span class="wm-tip-l"><CountryFlag code={hovered.code} /><span>{hovered.name}</span></span>
              <span class="tnum fg-muted">在线 {hovered.online}/{hovered.total}</span>
            </div>
            <div class="wm-tip-s tnum"><span class="tx">↑ {speed(hovered.tx)}</span><span class="rx">↓ {speed(hovered.rx)}</span></div>
            <div class="wm-tip-n">
              {hovered.nodeNames.slice(0, 6).join("、")}{hovered.nodeNames.length > 6 ? ` 等 ${hovered.nodeNames.length} 台` : ""}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <div data-testid="country-list" class="thin-scroll wm-list">
      {#if countryGroups.length === 0}
        <div class="wm-empty">暂无地区数据</div>
      {:else}
        {#each countryGroups as c (c.code)}
          <button
            type="button"
            data-testid="country-row"
            data-country={c.code}
            aria-pressed={selectedCountry === c.code}
            onclick={() => toggleCountry(c.code)}
            onmouseenter={() => (hovered = c)}
            onmouseleave={() => { if (hovered?.code === c.code) hovered = null }}
            class="wm-row"
            class:sel={selectedCountry === c.code}
          >
            <span class="wm-row-l"><CountryFlag code={c.code} /><span class="wm-row-name">{c.name}</span></span>
            <span class="wm-row-r tnum">
              <span class={c.online === c.total ? "wm-ok" : c.online > 0 ? "fg-warn" : "fg-subtle"}>{c.online}/{c.total}</span>
              <span class="tx" title="合计上行">↑ {speed(c.tx)}</span>
              <span class="rx" title="合计下行">↓ {speed(c.rx)}</span>
            </span>
          </button>
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  .wm-card { display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; padding: 12px; }
  .wm-head { z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .wm-pills { display: flex; align-items: center; gap: 6px; }
  .wm-off { display: inline-flex; align-items: center; gap: 4px; border-radius: 999px; background: var(--warn-soft); padding: 2px 8px; font-size: 11px; font-weight: 500; color: var(--warn-fg); }
  .wm-cnt { border-radius: 999px; border: 1px solid var(--border); background: var(--surface-subtle); padding: 2px 10px; font-size: 11px; color: var(--fg-muted); }
  .wm-body { margin-top: 8px; display: grid; grid-template-columns: minmax(0, 1fr); align-items: stretch; gap: 10px; }
  .wm-stage { position: relative; display: none; height: 160px; align-items: center; justify-content: center; }
  .wm-aspect { position: relative; aspect-ratio: 360 / 160; width: 100%; max-width: 360px; }
  .wm-svg { width: 100%; height: 100%; user-select: none; }
  .wm-pins { pointer-events: none; position: absolute; inset: 0; }
  .wm-pin { pointer-events: auto; position: absolute; transform: translate(-50%, -50%); display: inline-flex; cursor: pointer; align-items: center; gap: 4px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface); padding: 2px 4px 2px 2px; }
  .wm-pin:hover { z-index: 20; border-color: var(--border-strong); }
  .wm-pin.sel { z-index: 20; border-color: var(--accent); }
  .wm-pin-n { display: inline-flex; height: 14px; min-width: 14px; align-items: center; justify-content: center; border-radius: 999px; padding: 0 4px; font-size: 9.5px; line-height: 1; font-weight: 700; color: #fff; }
  .wm-tip { pointer-events: none; position: absolute; top: 4px; left: 4px; z-index: 30; max-width: 230px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); padding: 8px; font-size: 11px; }
  .wm-tip-h { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 700; color: var(--fg); }
  .wm-tip-l { display: inline-flex; align-items: center; gap: 4px; }
  .wm-tip-s { margin-top: 4px; display: flex; align-items: center; gap: 8px; font-size: 10.5px; }
  .wm-tip-n { margin-top: 4px; border-top: 1px solid var(--border-subtle); padding-top: 4px; font-size: 10.5px; color: var(--fg-muted); }
  .wm-list { display: flex; height: 160px; flex-direction: column; gap: 4px; overflow-y: auto; padding-right: 4px; }
  .wm-empty { padding: 24px 0; text-align: center; font-size: 12px; color: var(--fg-subtle); }
  .wm-row { display: flex; width: 100%; flex-shrink: 0; cursor: pointer; align-items: center; justify-content: space-between; gap: 6px; border-radius: 6px; border: 1px solid transparent; background: var(--surface-subtle); padding: 4px 8px; text-align: left; font-size: 12px; color: var(--fg-muted); }
  .wm-row:hover { background: var(--surface-hover); color: var(--fg); }
  .wm-row.sel { border-color: var(--accent-border); background: var(--accent-soft); font-weight: 600; color: var(--fg); }
  .wm-row-l { display: inline-flex; min-width: 0; align-items: center; gap: 6px; }
  .wm-row-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wm-row-r { display: flex; flex-shrink: 0; align-items: center; gap: 6px; font-size: 11px; white-space: nowrap; }
  .wm-ok { font-weight: 500; color: var(--fg); }
  @media (min-width: 520px) { .wm-stage { display: flex; } }
  @media (min-width: 1180px) { .wm-body { grid-template-columns: 7fr 5fr; } }
</style>
