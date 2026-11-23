<script module lang="ts">
  import type { summarizeNodes } from "@/lib/home-view.svelte"
  import { bytes, speed } from "@/lib/format"
  import { sparkPts } from "@/components/NodeCard.svelte"

  const SORTS = [["default", "默认顺序"], ["name", "名称"], ["cpu", "CPU"], ["mem", "内存"], ["disk", "硬盘"], ["tx", "上行"], ["rx", "下行"], ["expiry", "到期"]] as const
  const SKEL = Array(8)
  type StripStatus = "online" | "warn" | "offline"
  type Fleet = { tx: readonly number[]; rx: readonly number[]; cpu: readonly number[] }

  function compressStrip(strip: readonly StripStatus[]): StripStatus[] {
    if (strip.length <= 40) return strip as StripStatus[]
    const out: StripStatus[] = [], step = strip.length / 40
    for (let i = 0; i < 40; i++) {
      let w: StripStatus = "online"
      for (let j = Math.floor(i * step), e = Math.max(j + 1, Math.floor((i + 1) * step)); j < e && j < strip.length; j++) {
        if (strip[j] === "offline") { w = "offline"; break }
        if (strip[j] === "warn") w = "warn"
      }
      out.push(w)
    }
    return out
  }

  const pts = (vals: readonly number[], hi: number) => sparkPts(vals, hi, 220, 28, 3)

  const split = (s: string) => { const i = s.indexOf(" "); return i > 0 ? [s.slice(0, i), s.slice(i + 1)] : [s, ""] }

  function buildTiles(s: ReturnType<typeof summarizeNodes>, fleet: Fleet) {
    const net = split(speed(s.tx + s.rx)), mSum = s.month_tx + s.month_rx, tSum = s.total_tx + s.total_rx, mon = split(bytes(mSum))
    const netMax = Math.max(1, ...fleet.tx, ...fleet.rx), cpu = fleet.cpu.at(-1) ?? null, pk = s.peakCpu
    const notes = [s.offline && `${s.offline} 离线`, s.warn && `${s.warn} 告警`, s.expired ? `${s.expired} 到期` : s.expiring && `${s.expiring} 临期`].filter(Boolean).join(" · ") || "全部正常"
    return {
      strip: compressStrip(s.statusStrip ?? []),
      rxPts: pts(fleet.rx, netMax), txPts: pts(fleet.tx, netMax), cpuPts: pts(fleet.cpu, 100),
      mShare: tSum > 0 ? Math.min(100, Math.max(2, (mSum / tSum) * 100)).toFixed(1) : "0",
      tiles: [
        ["strip", "summary-servers", "服务器状态", `${(s.uptimeRatio * 100).toFixed(1)}%`, "mono fg-online", String(s.online), `/ ${s.total} 台`, notes, `${s.countries.size} 地区`, "", "mono"],
        ["net", undefined, "实时吞吐", "实时", "tx", net[0], net[1], `↑ ${speed(s.tx)}`, `↓ ${speed(s.rx)}`, "tx mono", "rx mono"],
        ["cpu", undefined, "平均 CPU", s.cores == null ? "" : `${s.cores} 核`, "mono", cpu == null ? "—" : cpu.toFixed(1), cpu == null ? "" : "%", pk ? `峰值 ${pk.name}` : "暂无在线节点", pk ? `${pk.value.toFixed(1)}%` : "", "", `mono fw6 ${pk && pk.value >= 90 ? "fg-danger" : pk && pk.value >= 80 ? "fg-warn" : ""}`],
        ["bar", undefined, "本期流量", "当期", "", mon[0], mon[1], `↑ ${bytes(s.month_tx)} · ↓ ${bytes(s.month_rx)}`, `总计 ${bytes(tSum)}`, "mono", "mono hide-sm"],
      ] as const,
    }
  }
</script>

<script lang="ts">
  import { onMount, type Component } from "svelte"
  import type { createApp } from "@/lib/app-state.svelte"
  import { batchLimit } from "@/lib/viewport.svelte"
  import NodeCard from "@/components/NodeCard.svelte"
  import { ALL_GROUP } from "@/lib/api"
  import { regionName } from "@/lib/format"
  import type { SortKey } from "@/lib/view-state"

  let { app }: { app: ReturnType<typeof createApp> } = $props()

  let TableComp = $state.raw<Component<any> | null>(null)
  let MapComp = $state.raw<Component<any> | null>(null)
  let mapErr = $state(false)

  $effect(() => { if (app.layout === "table" && !TableComp) void import("@/components/NodeTable.svelte").then((m) => (TableComp = m.default), () => {}) })
  $effect(() => { if (app.config.show_map && !MapComp) void import("@/components/WorldMap.svelte").then((m) => (MapComp = m.default), () => (mapErr = true)) })

  let total = $derived(app.home.directory.list.length)
  const limit = batchLimit(() => total)
  let batch = $derived(app.home.directory.list.slice(0, limit()))
  let showPing = $derived(app.pingEnabled && !app.snapshotOnly)

  onMount(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === "Escape") app.setQuery("")
      if (e.key === "/" && !(e.target instanceof HTMLElement && e.target.closest("input,textarea,select,[contenteditable=true]"))) {
        e.preventDefault(); document.querySelector<HTMLInputElement>('[data-testid="search-input"]')?.focus()
      }
    }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  })
</script>

{#if app.config.show_summary || app.config.show_map}
  <section data-testid="summary" aria-label="节点总览" class="overview {app.config.show_summary && app.config.show_map ? 'split' : ''}">
    {#if app.config.show_summary}
      <div class="tiles">
        {#if app.loading}
          <div class="panel tile bone" style="height:108px"></div><div class="panel tile bone" style="height:108px"></div>
          <div class="panel tile bone" style="height:108px"></div><div class="panel tile bone" style="height:108px"></div>
        {:else}
          {@const s = buildTiles(app.home.summary, app.history.fleet)}
          {#each s.tiles as [k, id, label, r, rCls, v, u, fl, fr, flCls, frCls] (k)}
            <div class="panel tile" data-testid="summary-tile">
              <div data-testid={id} class="kpi-inner">
                <div class="tile-label"><span>{label}</span><span class={rCls}>{r}</span></div>
                <div class="tile-value mono">{v}<small>{u}</small></div>
                {#if k === "strip"}
                  <div class="health-strip" data-testid="status-strip" aria-hidden="true">{#each s.strip as st}<i class={st === "warn" ? "w" : st === "offline" ? "o" : ""}></i>{/each}</div>
                {:else if k === "bar"}
                  <i class="hbar" style="--v:{s.mShare}%;height:8px"></i>
                {:else}
                  <svg class="kpi-spark" data-testid="fleet-spark" viewBox="0 0 220 28" preserveAspectRatio="none" aria-hidden="true">
                    {#if k === "cpu"}
                      <polygon fill="var(--accent-soft)" points="0,28 {s.cpuPts} 220,28" />
                      <polyline fill="none" stroke="var(--accent)" stroke-width="1.8" points={s.cpuPts} />
                    {:else}
                      <polyline fill="none" stroke="var(--rx)" stroke-width="1.8" points={s.rxPts} />
                      <polyline fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="3 2" points={s.txPts} />
                    {/if}
                  </svg>
                {/if}
                <div class="tile-note"><span class={flCls}>{fl}</span>{#if fr}<span class={frCls}>{fr}</span>{/if}</div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    {/if}

    {#if app.config.show_map}
      {#if mapErr}
        <div class="panel fg-muted" style="padding:16px;font-size:12px">地图加载失败，请刷新重试。</div>
      {:else if MapComp && !app.loading}
        <MapComp nodes={app.home.directory.grouped} readPing={app.ping.peek} selectedCountry={app.country} onSelectCountry={(c: string | null) => app.setCountry(c)} />
      {:else}
        <div class="panel map-placeholder" aria-label="加载地区分布"><span class="bone" style="display:block;height:16px;width:25%"></span></div>
      {/if}
    {/if}
  </section>
{/if}

<div class="toolbar">
  <div class="toolbar-left">
    {#if app.loading}
      <div class="bone" style="height:30px;width:208px"></div>
    {:else if app.home.directory.tabs.length > 0}
      <div role="tablist" aria-label="节点分组" class="scroll-hint tabs-scroll">
        <div class="tabs-track">
          {#each app.home.directory.tabs as tab (tab.key)}
            <button type="button" role="tab" data-testid="group-tab" aria-selected={app.group === tab.key} onclick={() => app.setGroup(tab.key)} class="tab">
              <span>{tab.label}</span><span class="cnt mono">{tab.count}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if app.country}
      <button type="button" data-testid="country-filter-chip" onclick={() => app.setCountry(null)} class="filter-chip">
        <span>地区：{regionName(app.country)}</span><span aria-hidden="true">×</span>
      </button>
    {/if}
  </div>

  <div class="directory-controls">
    <div class="seg" role="group" aria-label="视图切换">
      <button type="button" aria-label="卡片视图" aria-pressed={app.layout === "grid"} onclick={() => app.setLayout("grid")}>卡片</button>
      <button type="button" aria-label="列表视图" aria-pressed={app.layout === "table"} onclick={() => app.setLayout("table")}>列表</button>
    </div>

    {#if app.config.show_sort}
      <select data-testid="sort-select" aria-label="排序方式" value={app.sort} onchange={(e) => app.setSort((e.currentTarget as HTMLSelectElement).value as SortKey)} class="ctrl">
        {#each SORTS as [v, l]}<option value={v}>{l}</option>{/each}
      </select>
    {/if}

    {#if app.config.show_search}
      <div class="search-wrap">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M10.5 10.5L14 14M11 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" /></svg>
        <input type="search" data-testid="search-input" placeholder="搜索节点…" aria-label="搜索节点" value={app.query} oninput={(e) => app.setQuery((e.currentTarget as HTMLInputElement).value)} class="ctrl" />
      </div>
    {/if}
  </div>
</div>

{#if app.loading}
  <div data-testid="skeleton" aria-label="正在加载节点" aria-busy="true" class="node-grid {app.config.card_size === 'standard' ? 'standard' : ''}">
    {#each SKEL as _}<div class="panel card-placeholder bone" aria-hidden="true"></div>{/each}
  </div>
{:else if total === 0}
  <div data-testid="empty-state" class="panel empty-box">
    <p style="font-size:14px;font-weight:700">没有匹配的节点</p>
    <p class="fg-subtle" style="margin-top:4px;font-size:12px">当前筛选条件或搜索关键词下暂无结果</p>
    <button type="button" class="btn btn-primary" style="margin-top:12px;padding:0 14px" onclick={() => { app.setGroup(ALL_GROUP); app.setCountry(null); app.setQuery("") }}>清除筛选</button>
  </div>
{:else if app.layout === "table"}
  {#if TableComp}
    <TableComp ping={app.ping} {showPing} snapshotOnly={app.snapshotOnly} nodes={batch} {total} showBilling={app.config.show_billing} expiryWarningDays={app.config.expiry_warning_days} onSelect={(id: number) => app.selectNode(id)} />
  {/if}
{:else}
  <div class="node-grid {app.config.card_size === 'standard' ? 'standard' : ''}">
    {#each batch as node (node.id)}
      <NodeCard defer={total > 60} {node} {app} {showPing} />
    {/each}
    {#each Array(total - batch.length) as _}<div class="node-space" aria-hidden="true"></div>{/each}
  </div>
{/if}
