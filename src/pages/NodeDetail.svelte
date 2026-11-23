<script module lang="ts">
  const MODES: Record<string, string> = { up: "仅上传", down: "仅下载", max: "单向取大" }
  const errMsg = (e: unknown) => (e instanceof Error ? e.message : "读取历史数据失败")
  const level = (p: number | null | undefined) => (p == null ? "" : p >= 90 ? "danger" : p >= 80 ? "warn" : "")
</script>

<script lang="ts">
  import ChartCard from "@/components/ChartCard.svelte"
  import BrandIcon from "@/components/BrandIcon.svelte"
  import CountryFlag from "@/components/CountryFlag.svelte"
  import { api, type Node } from "@/lib/api"
  import { rangesFor, rangeLabel, metricCharts, pingCharts, probeSelection, toggleProbe, readProbes, saveProbes, type MetricsResponse } from "@/lib/detail-series"
  import { monthUsage, FOREVER, bytes, cpuName, expiry, priceFull, offlineFor, pair, percentNum, regionName, speed, uptime } from "@/lib/format"
  import { osKey } from "@/lib/icons"

  let {
    node,
    showPing,
    orderedNodes = [],
    groupLabel = "全部节点",
    historyDays = 7,
    showBilling = true,
    expiryWarningDays = 7,
    accent = "#10b981",
    onBack,
    onSelectNode,
  }: {
    node: Node
    showPing: boolean
    orderedNodes?: Node[]
    groupLabel?: string
    historyDays?: number
    showBilling?: boolean
    expiryWarningDays?: number
    accent?: string
    onBack: () => void
    onSelectNode?: (id: number) => void
  } = $props()

  let switcherList = $derived(orderedNodes.length > 0 ? orderedNodes : [node])
  let currentIndex = $derived(switcherList.findIndex((n) => n.id === node.id))
  let prevNode = $derived(currentIndex > 0 ? switcherList[currentIndex - 1] : null)
  let nextNode = $derived(currentIndex >= 0 && currentIndex < switcherList.length - 1 ? switcherList[currentIndex + 1] : null)

  let rangeHoursList = $derived(rangesFor(historyDays))
  let selectedHours = $state(6)
  let showPeak = $state(false)
  $effect(() => { if (!rangeHoursList.includes(selectedHours)) selectedHours = rangeHoursList[0] ?? 24 })

  let chartHost: HTMLDivElement | undefined = $state()
  let metricsResp = $state.raw<MetricsResponse | null>(null)
  let pingResp = $state.raw<MetricsResponse | null>(null)
  let metricErr = $state("")
  let pingErr = $state("")
  let updatedAt = $state("")
  let revision = $state(0)
  let resource = $derived(chartHost && `/nodes/${node.id}/metrics?hours=${selectedHours}&points=${Math.min(1440, Math.max(60, chartHost.clientWidth))}`)

  $effect(() => {
    void revision
    let cur = true
    metricsResp = null
    metricErr = ""
    if (resource) {
      void api<MetricsResponse>(resource + "&series=metrics").then(
        (d) => { if (cur) { metricsResp = d; updatedAt = new Date().toLocaleTimeString("zh-CN", { hour12: false }) } },
        (e) => { if (cur) metricErr = errMsg(e) },
      )
    }
    return () => { cur = false }
  })

  $effect(() => {
    void revision
    let cur = true
    pingResp = null
    pingErr = ""
    if (resource && showPing) {
      void api<MetricsResponse>(resource + "&series=ping").then(
        (d) => { if (cur) pingResp = d },
        (e) => { if (cur) pingErr = errMsg(e) },
      )
    }
    return () => { cur = false }
  })

  let metrics = $derived(metricCharts(metricsResp, accent, showPeak, node.metrics?.mem_total || node.mem_total, node.metrics?.disk_total || node.disk_total))
  let ping = $derived(pingCharts(pingResp, accent))
  let saved = $state.raw(readProbes())
  let selection = $derived(probeSelection(ping.probes, saved))
  function choose(next: string[] | null) { saved = next; saveProbes(next) }

  let tap = { name: "", time: 0 }
  function clickProbe(e: MouseEvent, name: string) {
    const touch = "pointerType" in e && e.pointerType === "touch"
    const twice = touch && tap.name === name && e.timeStamp - tap.time < 400
    tap = { name: touch && !twice ? name : "", time: e.timeStamp }
    choose(toggleProbe(selection.names, selection.active, name, e.altKey || twice || e.detail === 2))
  }

  function keyboard(e: KeyboardEvent) {
    if (e.altKey || e.ctrlKey || e.metaKey || (e.target instanceof HTMLElement && e.target.closest("input,textarea,select,[contenteditable=true]"))) return
    const target = e.key === "ArrowLeft" ? prevNode : e.key === "ArrowRight" ? nextNode : null
    if (target) { e.preventDefault(); onSelectNode?.(target.id) }
  }
</script>

<svelte:window onkeydown={keyboard} />

{#snippet stepButton(target: Node | null, label: string, glyph: string)}
  <button type="button" disabled={!target} onclick={() => target && onSelectNode?.(target.id)} title={label} aria-label={label} class="btn step-btn">{glyph}</button>
{/snippet}

{#snippet probeControls()}
  <div class="probe-controls" role="group" aria-label="选择探测节点">
    {#each ping.probes as p, i (p.id)}
      <button
        type="button"
        class="probe"
        data-testid="probe-chip"
        data-probe={p.name}
        aria-pressed={selection.show[i]}
        style:--probe={p.color}
        onclick={(e) => clickProbe(e, p.name)}
        ondblclick={() => choose([p.name])}
        title="Alt/⌥ 点击或双击仅看此探针"
      >
        <i aria-hidden="true"></i>{p.name} <span class="tnum">{p.avg == null ? "—" : `${p.avg}ms`}</span>
      </button>
    {/each}
    <button type="button" class="probe-all" data-testid="probe-all" disabled={selection.show.every(Boolean)} onclick={() => choose(null)}>全部</button>
  </div>
{/snippet}

{#if node}
{@const m = node.metrics}
{@const isCorrupt = Boolean(node._corrupt)}
{@const isWaiting = node.online && !m && !isCorrupt}
{@const offDur = !node.online ? offlineFor(node) : null}
{@const exp = expiry(node, Date.now(), expiryWarningDays)}
{@const lastSeenSec = "last_seen_ago" in node && node.last_seen_ago !== undefined ? node.last_seen_ago : node.last_seen && node.last_seen > 0 ? Math.max(0, Math.floor(Date.now() / 1000 - node.last_seen)) : null}
{@const hasSwap = (typeof node.swap_total === "number" && node.swap_total > 0) || (typeof m?.swap_total === "number" && m.swap_total > 0)}
{@const periodUsed = monthUsage(node)}
{@const trafficPct = node.traffic_limit > 0 ? percentNum(periodUsed, node.traffic_limit) : 0}
{@const info = [
  ["负载 1/5/15m", m?.load.map((v) => v.toFixed(2)).join(" / ") ?? "—"],
  ["Swap", hasSwap ? (m?.swap_used != null && m.swap_total != null ? pair(m.swap_used, m.swap_total) : bytes(node.swap_total ?? 0)) : null],
  ["进程", m?.procs],
  ["TCP / UDP", m?.tcp != null || m?.udp != null ? `${m?.tcp ?? "—"} / ${m?.udp ?? "—"}` : null],
  ["系统运行", m ? uptime(m.uptime) : "—"],
]}
{@const stats = [
  { label: "CPU", cap: node.cpu_cores ? `${node.cpu_cores} 核` : "—", pct: m?.cpu, note: `负载 ${m?.load[0]?.toFixed(2) ?? "—"}` },
  { label: "内存", cap: bytes(m?.mem_total || node.mem_total), pct: m && percentNum(m.mem_used, m.mem_total), note: m ? pair(m.mem_used, m.mem_total) : bytes(node.mem_total) },
  { label: "硬盘", cap: bytes(m?.disk_total || node.disk_total), pct: m && percentNum(m.disk_used, m.disk_total), note: m ? pair(m.disk_used, m.disk_total) : bytes(node.disk_total) },
]}
{@const hardware = [
  ["CPU 型号", cpuName(node.cpu_name)],
  ["CPU 核心", node.cpu_cores && `${node.cpu_cores} 核`],
  ["架构 / 虚拟化", [node.arch, node.virt === "none" ? "" : node.virt].filter(Boolean).join(" / ")],
  ["系统", node.os],
  ["内核", node.kernel],
  ["物理内存 / Swap", bytes(node.mem_total) + (hasSwap ? ` / ${bytes(node.swap_total || m?.swap_total || 0)}` : "")],
  ["磁盘总量", bytes(node.disk_total)],
  ["Agent 版本", node.agent_version],
  ...[["IP 地址", node.ip], ["主机名", node.hostname], ["备注", node.remark || node.public_remark]].filter(([, v]) => v),
]}
{@const billing = [
  ["当期上传 / 下载", `${bytes(node.month_tx)} / ${bytes(node.month_rx)}`],
  ["计费方向 / 重置日", (MODES[node.traffic_mode] ?? "双向合计") + (node.traffic_reset_day ? ` · 每月 ${node.traffic_reset_day} 日` : "")],
  ["累计上传 / 下载", `${bytes(node.total_tx)} / ${bytes(node.total_rx)}`],
  ...(showBilling ? [["录入标价", node.price > 0 ? priceFull(node.price, node.currency || "CNY", node.billing_cycle) : "免费 / 未设"]] : []),
  ["到期时间", node.expires_at ? `${node.expires_at} (${exp.text})` : exp.text || FOREVER],
]}
{@const fetchError = metricErr || pingErr}

<div class="d-stack">
  <div class="d-nav">
    <button type="button" onclick={onBack} class="btn">← 返回列表</button>
    <div data-testid="node-switcher" class="d-switch">
      <span class="tnum fg-muted">{groupLabel} · {switcherList.length} 台</span>
      {@render stepButton(prevNode, "上一个节点", "‹")}
      <select
        aria-label="切换节点"
        value={node.id}
        onchange={(e) => { const id = Number((e.currentTarget as HTMLSelectElement).value); if (id && id !== node.id) onSelectNode?.(id) }}
        class="ctrl d-sel"
      >
        {#each switcherList as item (item.id)}<option value={item.id}>{item.name}</option>{/each}
      </select>
      {@render stepButton(nextNode, "下一个节点", "›")}
    </div>
  </div>

  <div class="panel d-id">
    <div class="node-identity">
      <div class="min-w0">
        <div class="d-title">
          <CountryFlag code={node.country} />
          <h1>{node.name}</h1>
          <span class="tnum {node.online ? 'badge-online' : 'badge-offline'}">
            <i class="status-dot" style:background={node.online ? "var(--online)" : "var(--offline)"}></i>
            {node.online ? "在线" : `离线${offDur ? ` · ${offDur}` : ""}`}
          </span>
        </div>
        <p class="tnum d-sub">
          {[regionName(node.country) || "未知地区", node.group || "未分组", lastSeenSec === null ? "从未上报" : `最近上报 ${lastSeenSec} 秒前`].join(" · ")}
        </p>
      </div>
      <div data-testid="detail-stats" class="detail-stats tnum">
        {#each info as [lbl, val]}{#if val != null}<div><span class="fg-subtle">{lbl}</span><b>{val}</b></div>{/if}{/each}
      </div>
    </div>
    {#if isCorrupt || isWaiting}
      <div data-testid={isCorrupt ? "status-unavailable" : "status-waiting"} class="nc-notice">{isCorrupt ? "不可用" : "等待数据"}</div>
    {/if}
  </div>

  <div class="kpi-grid">
    {#each stats as s}
      {@const tone = level(s.pct)}
      <section class="panel kpi-card">
        <div class="kpi-top"><span>{s.label}</span><span class="tnum">{s.cap}</span></div>
        <div class="kpi-mid">
          <strong class="tnum">{s.pct == null ? "—" : `${s.pct.toFixed(1)}%`}</strong>
          <small class="tnum">{s.note}</small>
        </div>
        <i class="nc-bar {tone}" style:--v="{Math.min(100, Math.max(0, s.pct ?? 0))}%"></i>
      </section>
    {/each}
    <section class="panel kpi-card">
      <div class="kpi-top"><span>网络速率</span><span>实时</span></div>
      <p class="tnum tx kpi-net">↑ {speed(m?.net_tx ?? 0)}</p>
      <p class="tnum rx kpi-net">↓ {speed(m?.net_rx ?? 0)}</p>
    </section>
  </div>

  <div class="d-stack" bind:this={chartHost}>
    <div class="trend-toolbar">
      <div class="trend-head">
        <h2>资源趋势</h2>
        <p class="tnum">{showPeak ? "含区间峰值" : "历史平均值"}{updatedAt ? ` · 更新于 ${updatedAt}` : ""}</p>
      </div>
      <div class="scroll-hint range-scroll" role="group" aria-label="时间范围">
        <div class="range-track">
          {#each rangeHoursList as h (h)}
            <button type="button" data-testid="range-btn" aria-pressed={selectedHours === h} onclick={() => (selectedHours = h)} class="range-btn">{rangeLabel(h)}</button>
          {/each}
        </div>
      </div>
      <div class="trend-actions">
        <label class="desktop-peak"><input type="checkbox" bind:checked={showPeak} /><span>显示峰值</span></label>
        <button type="button" class="mobile-peak trend-action btn" aria-label="显示峰值" title="显示峰值" aria-pressed={showPeak} onclick={() => (showPeak = !showPeak)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18h18M3 14l5-6 4 4 5-8 4 6" /></svg>
        </button>
        <button type="button" aria-label="刷新" title="刷新" onclick={() => revision++} class="trend-action btn h28">
          <span class="refresh-text">刷新</span>
          <svg class="refresh-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10a8 8 0 1 0-1.8 7.2M20 4v6h-6" /></svg>
        </button>
      </div>
    </div>

    {#if fetchError}
      <div class="panel d-msg fg-danger">读取历史数据失败：{fetchError}</div>
    {:else if !metricsResp && !pingResp}
      <div class="panel d-msg fg-subtle">正在加载图表数据…</div>
    {:else}
      <div class="charts-4">
        {#each metrics.slice(0, 4) as spec (spec.title)}
          <ChartCard
            {...spec}
            subtitle={spec.title === "CPU 使用率" && m ? `${m.cpu.toFixed(1)}%` : spec.title === "网络速率" && m ? `↑ ${speed(m.net_tx)} ↓ ${speed(m.net_rx)}` : spec.subtitle}
          />
        {/each}
      </div>
      {#each metrics.slice(4) as spec (spec.title)}<ChartCard {...spec} />{/each}
      {#if showPing && ping.charts.length}
        <div class="charts-ping" class:two={selection.hasLoss}>
          {#each ping.charts as spec, i (spec.title)}
            <div hidden={i === 1 && !selection.hasLoss} class="min-w0">
              <ChartCard {...spec} show={selection.show} noLoss={i === 0 && selection.noLoss} controls={i === 0 && selection.names.length > 1 ? probeControls : undefined} />
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  <div class="spec-grid">
    {#each [["硬件与系统", hardware], ["流量与费用", billing]] as const as [title, fields]}
      <section class="panel spec-card">
        <h3>{title}</h3>
        {#if title === "流量与费用"}
          <div class="bill-box">
            <div class="bill-top">
              <span>当期计费流量</span>
              <span class="tnum">{node.traffic_limit > 0 ? `${pair(periodUsed, node.traffic_limit)} (${trafficPct.toFixed(1)}%)` : `${bytes(periodUsed)} / ${FOREVER}`}</span>
            </div>
            <i class="nc-bar {level(trafficPct)}" style:--v="{Math.min(100, Math.max(0, trafficPct))}%"></i>
          </div>
        {/if}
        <dl class="spec-dl">
          {#each fields as [lbl, val]}
            <div class="spec-item">
              <dt>{lbl}</dt>
              <dd class="tnum {lbl === '到期时间' && exp.level === 'expired' ? 'fg-danger' : lbl === '到期时间' && exp.level === 'soon' ? 'fg-warn' : ''}">
                {#if lbl === "系统"}<BrandIcon key={osKey(node.os)} title={node.os} />{" "}{/if}{val || "—"}
              </dd>
            </div>
          {/each}
        </dl>
      </section>
    {/each}
  </div>
</div>
{/if}

<style>
  .d-stack { display: flex; flex-direction: column; gap: 12px; }
  .d-nav, .d-switch, .d-title, .trend-toolbar, .trend-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .d-nav { justify-content: space-between; }
  .d-switch { gap: 6px; font-size: 12px; }
  .d-sel { max-width: 200px; cursor: pointer; text-overflow: ellipsis; }
  .step-btn { width: 30px; padding: 0; }
  .d-id, .spec-card { padding: 14px; }
  .d-title h1 { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: var(--fg); }
  .d-sub { margin-top: 4px; font-size: 12px; color: var(--fg-subtle); }
  .min-w0 { min-width: 0; }
  .node-identity { display: grid; align-items: center; gap: 10px; }
  .detail-stats { display: flex; flex-wrap: wrap; align-items: baseline; gap: 5px 14px; font-size: 12px; }
  .detail-stats > div { white-space: nowrap; }
  .detail-stats b { margin-left: 6px; font-weight: 600; color: var(--fg); }
  .kpi-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .kpi-card { padding: 12px; }
  .kpi-top { display: flex; justify-content: space-between; font-size: 12px; color: var(--fg-muted); }
  .kpi-mid { margin: 8px 0; display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px; }
  .kpi-mid strong { font-size: 22px; font-weight: 700; letter-spacing: -0.03em; color: var(--fg); }
  .kpi-mid small { font-size: 11px; color: var(--fg-subtle); }
  .kpi-net { margin-top: 6px; font-size: 14px; font-weight: 600; }
  .kpi-net + .kpi-net { margin-top: 2px; }
  .trend-head { margin-right: auto; }
  .trend-head h2, .spec-card h3 { font-size: 14px; font-weight: 700; color: var(--fg); }
  .trend-head p { font-size: 11px; color: var(--fg-subtle); }
  .range-scroll { min-width: 0; max-width: 100%; overflow-x: auto; }
  .range-track { display: flex; width: max-content; align-items: center; gap: 4px; padding: 2px 0; }
  .range-btn { height: 28px; padding: 0 9px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--fg-muted); font-size: 12px; font-weight: 500; cursor: pointer; white-space: nowrap; }
  .range-btn:hover { background: var(--surface-hover); color: var(--fg); }
  .range-btn[aria-pressed="true"] { background: var(--accent-solid); border-color: transparent; color: var(--accent-solid-fg); font-weight: 600; }
  .desktop-peak { display: inline-flex; cursor: pointer; align-items: center; gap: 6px; font-size: 12px; color: var(--fg-muted); }
  .desktop-peak input { accent-color: var(--accent); }
  .h28 { height: 28px; }
  .d-msg { padding: 32px 16px; text-align: center; font-size: 12px; }
  .charts-4, .charts-ping, .spec-grid { display: grid; gap: 12px; }
  .charts-4 { grid-template-columns: minmax(0, 1fr); align-items: start; }
  .probe-controls { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 6px 0 10px; }
  .probe-controls button { font-size: 12px; padding: 3px 9px; cursor: pointer; touch-action: manipulation; }
  button.probe { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface-subtle); color: var(--fg-subtle); }
  .probe i { width: 7px; height: 7px; border-radius: 50%; background: var(--offline); }
  .probe[aria-pressed="true"] { color: var(--fg); border-color: color-mix(in srgb, var(--probe) 45%, var(--border)); background: color-mix(in srgb, var(--probe) 10%, var(--surface)); }
  .probe[aria-pressed="true"] i { background: var(--probe); }
  .probe-all { color: var(--fg-muted); text-decoration: underline; background: transparent; border: 0; }
  .probe-all:disabled { color: var(--fg-subtle); text-decoration: none; cursor: default; }
  .bill-box { margin-top: 10px; border-radius: 6px; border: 1px solid var(--accent-border); background: var(--accent-soft); padding: 8px 12px; font-size: 12px; }
  .bill-top { margin-bottom: 6px; display: flex; justify-content: space-between; gap: 8px; font-weight: 500; color: var(--fg); }
  .spec-dl { margin-top: 10px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .spec-item { min-width: 0; border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--surface-subtle); padding: 8px 12px; }
  .spec-item dt { font-size: 11px; color: var(--fg-subtle); }
  .spec-item dd { margin-top: 2px; font-weight: 500; color: var(--fg); white-space: pre-line; overflow-wrap: break-word; }
  .mobile-peak, .refresh-icon { display: none; }
  @media (min-width: 640px) { .spec-dl { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (min-width: 768px) { .charts-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (min-width: 900px) { .node-identity { grid-template-columns: minmax(0, 1fr) auto; } .detail-stats { flex-wrap: nowrap; justify-content: flex-end; } }
  @media (min-width: 1024px) { .kpi-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } .charts-ping.two, .spec-grid { grid-template-columns: 1fr 1fr; } }
  @media (min-width: 1280px) { .charts-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  @media (width < 640px) {
    .kpi-mid { flex-direction: column; align-items: flex-start; gap: 2px; }
    .trend-toolbar { display: grid; grid-template-columns: minmax(0, 1fr) auto; }
    .trend-actions { grid-area: 1 / 2; }
    .range-scroll { grid-area: 2 / 1 / auto / -1; }
    .range-track button { min-width: 64px; min-height: 38px; padding-inline: 12px; }
    .desktop-peak, .refresh-text { display: none; }
    .refresh-icon { display: block; }
    .trend-action { display: inline-grid; place-items: center; width: 40px; height: 40px; padding: 0; }
    .mobile-peak[aria-pressed="true"] { color: var(--accent-solid-fg); background: var(--accent-solid); border-color: transparent; }
  }
</style>
