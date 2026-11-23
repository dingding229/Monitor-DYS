<script module lang="ts">
  import type { summarizeNodes } from "@/lib/home-view.svelte"
  import { bytes, speed } from "@/lib/format"

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

  function pts(vals: readonly number[], hi: number): string {
    const n = vals.length
    if (!n) return "0,24 220,24"
    const y = (v: number) => (25 - (Math.min(hi, Math.max(0, v)) / hi) * 21).toFixed(1)
    if (n === 1) return `0,${y(vals[0])} 220,${y(vals[0])}`
    return vals.map((v, i) => `${((i / (n - 1)) * 220).toFixed(1)},${y(v)}`).join(" ")
  }

  const split = (s: string) => { const i = s.indexOf(" "); return i > 0 ? [s.slice(0, i), s.slice(i + 1)] : [s, ""] }

  function buildTiles(s: ReturnType<typeof summarizeNodes>, fleet: Fleet, loading: boolean) {
    const net = split(speed(s.tx + s.rx)), mSum = s.month_tx + s.month_rx, tSum = s.total_tx + s.total_rx, mon = split(bytes(mSum))
    const netMax = Math.max(1, ...fleet.tx, ...fleet.rx), cpu = fleet.cpu.at(-1) ?? null, pk = s.peakCpu
    const notes = [s.offline && `${s.offline} 离线`, s.warn && `${s.warn} 告警`, s.expired ? `${s.expired} 到期` : s.expiring && `${s.expiring} 临期`].filter(Boolean).join(" · ") || "全部正常"
    return {
      strip: compressStrip(s.statusStrip ?? []),
      rxPts: pts(fleet.rx, netMax), txPts: pts(fleet.tx, netMax), cpuPts: pts(fleet.cpu, 100),
      mShare: tSum > 0 ? Math.min(100, Math.max(2, (mSum / tSum) * 100)).toFixed(1) : "0",
      tiles: [
        ["strip", "summary-servers", "服务器状态", loading ? "—" : `${(s.uptimeRatio * 100).toFixed(1)}%`, "mono fg-online", String(s.online), `/ ${s.total} 台`, notes, `${s.countries.size} 地区`, "", "mono", 9],
        ["net", undefined, "实时吞吐", "实时", "tx", net[0], net[1], `↑ ${speed(s.tx)}`, `↓ ${speed(s.rx)}`, "tx mono", "rx mono", 26],
        ["cpu", undefined, "平均 CPU", loading || s.cores == null ? "" : `${s.cores} 核`, "mono", cpu == null ? "—" : cpu.toFixed(1), cpu == null ? "" : "%", pk ? `峰值 ${pk.name}` : "暂无在线节点", pk ? `${pk.value.toFixed(1)}%` : "", "", `mono fw6 ${pk && pk.value >= 90 ? "fg-danger" : pk && pk.value >= 80 ? "fg-warn" : ""}`, 26],
        ["bar", undefined, "本期流量", "当期", "", mon[0], mon[1], `↑ ${bytes(s.month_tx)} · ↓ ${bytes(s.month_rx)}`, `总计 ${bytes(tSum)}`, "mono", "mono hide-sm", 8],
      ] as const,
    }
  }
</script>

<script lang="ts">
  import type { Component } from "svelte"
  import type { createApp } from "@/lib/app-state.svelte"

  let { app }: { app: ReturnType<typeof createApp> } = $props()
  let MapComp = $state.raw<Component<any> | null>(null)
  let mapErr = $state(false)
  $effect(() => {
    if (!app.config.show_map || MapComp) return
    let cur = true
    import("./WorldMap.svelte").then((m) => { if (cur) MapComp = m.default }, () => { if (cur) mapErr = true })
    return () => { cur = false }
  })
</script>

{#if app.config.show_summary || app.config.show_map}
  {@const s = buildTiles(app.home.summary, app.history.fleet, app.loading)}
  <section data-testid="summary" aria-label="节点总览" class="overview {app.config.show_summary && app.config.show_map ? 'split' : ''}">
    {#if app.config.show_summary}
      <div class="tiles">
        {#each s.tiles as [k, id, label, r, rCls, v, u, fl, fr, flCls, frCls, bh] (k)}
          <div class="panel tile" data-testid="summary-tile">
            <div data-testid={id} class="kpi-inner">
              <div class="tile-label"><span>{label}</span><span class={rCls}>{r}</span></div>
              {#if app.loading}
                <div class="bone" style="height:26px;width:60%"></div>
                <div class="bone" style="height:{bh}px;width:100%"></div>
              {:else}
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
              {/if}
              <div class="tile-note">
                <span class={flCls}>{app.loading ? "" : fl}</span>
                {#if !app.loading && fr}<span class={frCls}>{fr}</span>{/if}
              </div>
            </div>
          </div>
        {/each}
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
