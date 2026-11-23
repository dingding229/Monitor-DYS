<script module lang="ts">
  const MAP_W = 420
  const MAP_H = 192
  const GRAT_X = [60, 120, 180, 240, 300, 360]
  const GRAT_Y = [38, 76, 114, 152]
  const latClass = (ms: number | null) => (ms == null ? "" : ms < 80 ? "g" : ms <= 160 ? "w" : "d")
</script>

<script lang="ts">
  import CountryFlag from "@/components/CountryFlag.svelte"
  import type { Node } from "@/lib/api"
  import { regionName, speed } from "@/lib/format"
  import { countryCentroid, getWorldLandDots, projectGeo } from "@/lib/geo"
  import { createCountryView, type CountryCounts, type ReadPing } from "@/lib/home-view.svelte"

  let { nodes, readPing, selectedCountry = null, onSelectCountry }: {
    nodes: readonly Node[]
    readPing: ReadPing
    selectedCountry?: string | null
    onSelectCountry: (code: string | null) => void
  } = $props()

  let mapEl: HTMLElement | undefined = $state()
  let boxEl: HTMLDivElement | undefined = $state()
  const bindMap = (el: HTMLElement) => { mapEl = el }
  const bindBox = (el: HTMLDivElement) => { boxEl = el }
  let hovered = $state<CountryGroup | null>(null)
  let expanded = $state(false)
  const countryView = createCountryView(() => nodes, () => Boolean(hovered || mapEl?.matches(":hover")), (id) => readPing(id))

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

    const MIN_DX = 22, MIN_DY = 15
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
              a.dispY = Math.max(16, Math.min(MAP_H - 12, a.dispY - pushY))
              b.dispY = Math.max(16, Math.min(MAP_H - 12, b.dispY + pushY))
            }
          }
        }
      }
    }
    return list
  })

  let countByCode = $derived(new Map(countryGroups.map((c) => [c.code, c.total])))
  let totals = $derived(countryView.aggregate.totals)

  function dotColor(code: string): string {
    const cnt = countByCode.get(code)
    if (!cnt) return "#cbd6e4"
    if (hovered?.code === code || selectedCountry === code) return "var(--accent)"
    return cnt >= 2 ? "color-mix(in srgb, var(--accent) 78%, #d8e1ec)" : "color-mix(in srgb, var(--accent) 46%, #d8e1ec)"
  }
  function markerColor(c: CountryGroup): string {
    return c.online === 0 ? "var(--offline)" : c.warn || c.online < c.total ? "var(--warn-bar)" : "var(--accent)"
  }
  function toggleCountry(code: string) {
    onSelectCountry(selectedCountry === code ? null : code)
  }

  let tipStyle = $derived.by(() => {
    if (!hovered) return ""
    const boxW = boxEl?.clientWidth || 360
    const boxH = boxEl?.clientHeight || 195
    const tipW = 148, tipH = 88
    const px = (hovered.dispX / MAP_W) * boxW
    const py = (hovered.dispY / MAP_H) * boxH
    let left = px + 14
    if (left + tipW + 6 > boxW) left = px - tipW - 14
    left = Math.max(6, Math.min(boxW - tipW - 6, left))
    let top = Math.max(6, Math.min(boxH - tipH - 6, py - tipH / 2))
    return `left:${Math.round(left)}px;top:${Math.round(top)}px`
  })
</script>

<div use:bindMap class="panel radar-card">
  <div class="radar-head">
    <div class="radar-summary" data-testid="region-summary">
      <span class="r-stat"><b>{totals.regions}</b> 个地区</span>
      <span class="r-stat ok">在线率 <b>{(totals.onlineRate * 100).toFixed(1)}%</b></span>
      {#if totals.avgLatency != null}
        <span class="r-stat">平均延迟 <b>{Math.round(totals.avgLatency)} ms</b></span>
      {/if}
    </div>
  </div>

  <div class="radar-body">
    <div class="map-col">
      <div use:bindBox data-testid="world-map" class="radar-box">
        <svg viewBox="0 0 {MAP_W} {MAP_H}" preserveAspectRatio="xMidYMid meet" class="wm-svg" aria-label="全球节点分布图">
          <g class="c-grat" aria-hidden="true">
            {#each GRAT_X as x}<line x1={x} y1="0" x2={x} y2={MAP_H} />{/each}
            {#each GRAT_Y as y}<line x1="0" y1={y} x2={MAP_W} y2={y} />{/each}
          </g>
          <g fill="none" stroke-linecap="round">
            {#each land as [country, path] (country)}
              <path d={path} stroke={dotColor(country)} stroke-width={countByCode.has(country) ? 2.4 : 1.7} />
            {/each}
          </g>
          {#each countryGroups as m (m.code)}
            {@const col = markerColor(m)}
            {@const coreR = m.total >= 2 ? 4.4 : 3.5}
            {@const bx = m.dispX > MAP_W - 30 ? m.dispX - 18 : m.dispX + 6}
            {@const by = m.dispY < 18 ? m.dispY + 2 : m.dispY - 8}
            {#if Math.hypot(m.dispX - m.x, m.dispY - m.y) > 3}
              <line x1={m.x} y1={m.y} x2={m.dispX} y2={m.dispY} stroke="var(--fg-subtle)" stroke-width="0.7" stroke-dasharray="1.5 1.5" />
            {/if}
            <g
              class="m-pin {selectedCountry === m.code ? 'sel' : ''}"
              role="button"
              tabindex="0"
              data-testid="map-country"
              data-country={m.code}
              data-count={m.total}
              aria-pressed={selectedCountry === m.code}
              aria-label="{m.name} 在线 {m.online}/{m.total}"
              onclick={() => toggleCountry(m.code)}
              onkeydown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggleCountry(m.code))}
              onmouseenter={() => (hovered = m)}
              onmouseleave={() => { if (hovered?.code === m.code) hovered = null }}
              onfocus={() => (hovered = m)}
              onblur={() => { if (hovered?.code === m.code) hovered = null }}
            >
              {#if m.online > 0}
                <circle class="m-pulse" cx={m.dispX} cy={m.dispY} r={coreR + 1.5} fill={col} />
              {/if}
              <circle cx={m.dispX} cy={m.dispY} r={coreR} fill={col} stroke="#ffffff" stroke-width="1.3" />
              {#if m.online > 0 && m.online < m.total}
                <circle cx={m.dispX - 4.2} cy={m.dispY + 4.2} r="2.3" fill="var(--offline)" stroke="#ffffff" stroke-width="0.8" />
              {/if}
              <g class="m-badge" transform="translate({bx},{by})">
                <rect x="0" y="0" width={m.total >= 10 ? 15 : 11} height="10" rx="3" />
                <text x={m.total >= 10 ? 7.5 : 5.5} y="7.5" text-anchor="middle">{m.total}</text>
              </g>
            </g>
          {/each}
        </svg>

        {#if hovered}
          <div class="map-tip" style={tipStyle}>
            <div class="mt-head">
              <span class="mt-name"><CountryFlag code={hovered.code} /><span>{hovered.name}</span></span>
              <span class="mono" style="color:{hovered.online === hovered.total ? 'var(--online)' : 'var(--warn)'}">{hovered.online}/{hovered.total}</span>
            </div>
            <div class="mt-grid">
              <span>实时上行</span><b class="tx">↑ {speed(hovered.tx)}</b>
              <span>实时下行</span><b class="rx">↓ {speed(hovered.rx)}</b>
              {#if hovered.latency != null}
                <span>平均延迟</span><b class={latClass(hovered.latency) ? `fg-${latClass(hovered.latency) === "g" ? "online" : latClass(hovered.latency) === "w" ? "warn" : "danger"}` : ""}>{Math.round(hovered.latency)} ms</b>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <div class="map-legend" aria-hidden="true">
        <span class="ml-grp">
          <span><i class="ml-sw" style="background:#cbd6e4"></i>0</span>
          <span><i class="ml-sw" style="background:color-mix(in srgb,var(--accent) 46%,#d8e1ec)"></i>1台</span>
          <span><i class="ml-sw" style="background:color-mix(in srgb,var(--accent) 78%,#d8e1ec)"></i>2+台</span>
        </span>
        <span class="ml-grp">
          <span><i class="ml-dot" style="background:var(--accent)"></i>在线</span>
          <span><i class="ml-dot" style="background:var(--warn-bar)"></i>告警</span>
          <span><i class="ml-dot" style="background:var(--offline)"></i>离线</span>
        </span>
      </div>
    </div>

    <div class="r-col">
      <div data-testid="country-list" class="thin-scroll r-list {expanded ? 'expanded' : ''}">
        {#if countryGroups.length === 0}
          <div class="wm-empty">暂无地区数据</div>
        {:else}
          {#each countryGroups as c, idx (c.code)}
            <button
              type="button"
              data-testid="country-row"
              data-country={c.code}
              aria-pressed={selectedCountry === c.code}
              onclick={() => toggleCountry(c.code)}
              onmouseenter={() => (hovered = c)}
              onmouseleave={() => { if (hovered?.code === c.code) hovered = null }}
              class="r-row {idx >= 6 && !expanded ? 'extra-d' : ''} {idx === 5 && !expanded ? 'extra-m' : ''}"
            >
              <CountryFlag code={c.code} />
              <span class="nm">{c.name}</span>
              <span class="r-prog">
                <i style="--v:{c.total ? Math.round((c.online / c.total) * 100) : 0}%;--c:{c.online === c.total ? 'var(--online-led)' : c.online > 0 ? 'var(--warn-bar)' : 'var(--offline)'}"></i>
                <span>{c.online}/{c.total}</span>
              </span>
              <span class="sp mono">
                <span class="tx">↑{speed(c.tx).replace(" ", "")}</span>
                <span class="rx">↓{speed(c.rx).replace(" ", "")}</span>
              </span>
              <span class="lat-tag {latClass(c.latency)}">{c.latency == null ? "—" : `${Math.round(c.latency)}ms`}</span>
            </button>
          {/each}
        {/if}
      </div>
      {#if countryGroups.length > 5}
        <button type="button" class="r-more {countryGroups.length <= 6 ? 'mobile-only' : ''}" onclick={() => (expanded = !expanded)}>
          {#if expanded}收起{:else}另外 <span class="cnt-d">{countryGroups.length - 6}</span><span class="cnt-m">{countryGroups.length - 5}</span> 个地区{/if}
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .radar-card { padding: 14px; display: flex; flex-direction: column; gap: 10px; height: 100%; }
  .radar-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
  .radar-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .r-stat { display: inline-flex; align-items: center; gap: 5px; padding: 2px 9px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--border-sub); font-size: 11.5px; font-weight: 500; color: var(--fg-muted); }
  .r-stat b { color: var(--fg); font-family: var(--font-mono); }
  .r-stat.ok { background: var(--online-soft); border-color: var(--online-border); color: var(--online); }
  .r-stat.ok b { color: var(--online); }

  .radar-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; align-items: stretch; flex: 1; min-height: 0; }
  .map-col { display: flex; flex-direction: column; gap: 6px; min-width: 0; height: 100%; }
  .radar-box { flex: 1; min-height: 185px; width: 100%; border-radius: 6px; border: 1px solid var(--border-sub); background: linear-gradient(180deg, #f4f7fb 0%, #edf2f8 100%); position: relative; overflow: hidden; }
  .wm-svg { width: 100%; height: 100%; display: block; user-select: none; }
  .c-grat { stroke: #d8e2ee; stroke-width: 0.45; stroke-dasharray: 2 3; }

  .m-pin { cursor: pointer; outline: none; }
  .m-pulse { transform-box: fill-box; transform-origin: center; animation: map-pulse 2.4s ease-out infinite; }
  @keyframes map-pulse { 0% { transform: scale(0.9); opacity: 0.55; } 70%, 100% { transform: scale(2.15); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .m-pulse { animation: none; opacity: 0.25; } }
  .m-badge rect { fill: #ffffff; stroke: var(--border-strong); stroke-width: 0.8; }
  .m-pin.sel .m-badge rect { stroke: var(--accent); stroke-width: 1.2; }
  .m-badge text { font-family: var(--font-mono); font-size: 7.5px; font-weight: 700; fill: var(--fg); }

  .map-tip { position: absolute; z-index: 15; pointer-events: none; width: 148px; padding: 7px 9px; border-radius: 6px; background: rgba(255, 255, 255, 0.97); border: 1px solid var(--border-strong); box-shadow: 0 6px 18px -4px rgba(15, 23, 42, 0.16); font-size: 11px; color: var(--fg); }
  .mt-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; font-weight: 700; padding-bottom: 4px; border-bottom: 1px solid var(--border-sub); }
  .mt-name { display: inline-flex; align-items: center; gap: 5px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mt-grid { margin-top: 4px; display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; font-size: 10.5px; }
  .mt-grid span { color: var(--fg-subtle); }
  .mt-grid b { text-align: right; font-family: var(--font-mono); }

  .map-legend { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 10px; padding: 4px 8px; border-radius: 5px; background: var(--surface-2); border: 1px solid var(--border-sub); font-size: 10.5px; color: var(--fg-subtle); }
  .ml-grp { display: inline-flex; align-items: center; gap: 6px; }
  .ml-sw { display: inline-block; width: 10px; height: 7px; border-radius: 2px; vertical-align: middle; margin-right: 2px; }
  .ml-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; vertical-align: middle; margin-right: 2px; }

  .r-col { display: flex; flex-direction: column; gap: 5px; min-width: 0; min-height: 0; height: 100%; }
  .r-list { display: flex; flex-direction: column; gap: 5px; flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding-right: 2px; }
  .wm-empty { padding: 24px 0; text-align: center; font-size: 12px; color: var(--fg-subtle); }
  .r-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto auto; align-items: center; gap: 7px; height: 32px; flex-shrink: 0; padding: 0 9px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--border-sub); font-size: 12px; text-align: left; white-space: nowrap; cursor: pointer; transition: border-color 120ms, background-color 120ms; }
  .r-row:hover, .r-row[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); }
  .r-row .nm { font-weight: 600; color: var(--fg); overflow: hidden; text-overflow: ellipsis; }
  .r-prog { display: inline-flex; align-items: center; gap: 5px; }
  .r-prog i { display: block; width: 32px; height: 5px; border-radius: 2px; background: var(--track); position: relative; overflow: hidden; }
  .r-prog i::before { content: ""; position: absolute; inset: 0 auto 0 0; width: var(--v, 100%); background: var(--c, var(--online-led)); }
  .r-prog span { font-family: var(--font-mono); font-size: 10.5px; font-weight: 600; color: var(--fg-muted); min-width: 24px; text-align: right; }
  .r-row .sp { font-size: 10.5px; display: inline-flex; gap: 5px; }
  .lat-tag { padding: 1px 5px; border-radius: 4px; font-family: var(--font-mono); font-size: 10.5px; font-weight: 700; text-align: right; min-width: 42px; color: var(--fg-subtle); background: var(--surface); }
  .lat-tag.g { background: var(--online-soft); color: var(--online); }
  .lat-tag.w { background: var(--warn-soft); color: var(--warn); }
  .lat-tag.d { background: var(--danger-soft); color: var(--danger); }
  .r-row.extra-d { display: none; }
  .r-more { height: 26px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--fg-muted); font-size: 11px; font-weight: 500; cursor: pointer; flex-shrink: 0; }
  .r-more:hover { border-color: var(--border-strong); color: var(--fg); background: var(--surface-hover); }
  .r-more.mobile-only, .cnt-m { display: none; }

  @media (min-width: 1120px) { .radar-body { grid-template-columns: minmax(0, 1.08fr) minmax(0, 1.08fr); } }
  @media (max-width: 639px) {
    .map-col, .cnt-d { display: none; }
    .cnt-m { display: inline; }
    .r-list { max-height: 180px; }
    .r-row { grid-template-columns: auto minmax(0, 1fr) auto auto; }
    .r-row .sp { display: none; }
    .r-row.extra-m { display: none; }
    .r-more.mobile-only { display: block; }
  }
</style>
