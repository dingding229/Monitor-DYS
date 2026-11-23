<script module lang="ts">
  import type { Node } from "@/lib/api"
  import { monthUsage, FOREVER, bytes, cpuName, expiry, priceFull, offlineFor, pair, percentNum, regionName, speed, uptime } from "@/lib/format"

  const MODES: Record<string, string> = { up: "仅上传", down: "仅下载", max: "单向取大" }
  const errMsg = (e: unknown) => (e instanceof Error ? e.message : "读取历史数据失败")
  const level = (p: number | null | undefined) => (p == null ? "" : p >= 90 ? "danger" : p >= 80 ? "warn" : "")
  const readAccent = () => (typeof document === "undefined" ? "#0d9488" : getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#0d9488")

  function buildDetail(node: Node, showBilling: boolean, expiryWarningDays: number) {
    const m = node.metrics, isCorrupt = Boolean(node._corrupt), isWaiting = node.online && !m && !isCorrupt
    const offDur = !node.online ? offlineFor(node) : null, exp = expiry(node, Date.now(), expiryWarningDays)
    const ago = "last_seen_ago" in node && node.last_seen_ago !== undefined ? node.last_seen_ago : node.last_seen > 0 ? Math.max(0, Math.floor(Date.now() / 1000 - node.last_seen)) : null
    const swapTot = node.swap_total || m?.swap_total || 0, hasSwap = swapTot > 0
    const periodUsed = monthUsage(node), trafficPct = node.traffic_limit > 0 ? percentNum(periodUsed, node.traffic_limit) : 0
    const memTot = m?.mem_total || node.mem_total, diskTot = m?.disk_total || node.disk_total
    const memPct = m && memTot > 0 ? percentNum(m.mem_used, memTot) : null
    const diskPct = m && diskTot > 0 ? percentNum(m.disk_used, diskTot) : null
    const cpuTone = level(m?.cpu)
    return {
      m, isCorrupt, isWaiting, exp, periodUsed, trafficPct,
      statusText: node.online ? `在线${m ? ` · ${uptime(m.uptime)}` : ""}` : `离线${offDur ? ` · ${offDur}` : ""}`,
      hwSummary: [cpuName(node.cpu_name), node.cpu_cores && `${node.cpu_cores} 核`, memTot && `${bytes(memTot)} 内存`, diskTot && `${bytes(diskTot)} 硬盘`, node.virt !== "none" && node.virt, ago === null ? "从未上报" : `最近上报 ${ago} 秒前`].filter(Boolean).join(" · "),
      info: [
        ["负载 1/5/15m", m?.load.map((v) => v.toFixed(2)).join(" / ") ?? "—"],
        ["进程", m?.procs],
        ["TCP / UDP", m?.tcp != null || m?.udp != null ? `${m?.tcp ?? "—"} / ${m?.udp ?? "—"}` : null],
        ["Swap", hasSwap ? (m?.swap_used != null && m.swap_total != null ? pair(m.swap_used, m.swap_total) : bytes(swapTot)) : null],
      ] as [string, string | number | null | undefined][],
      kpis: [
        ["CPU", node.cpu_cores ? `${node.cpu_cores} 核` : "—", m?.cpu ?? null, `负载 ${m ? m.load.slice(0, 2).map((v) => v.toFixed(2)).join(" / ") : "—"}`, !m ? "—" : cpuTone === "danger" ? "告警" : cpuTone === "warn" ? "偏高" : "正常", cpuTone ? `fg-${cpuTone}` : "fg-online"],
        ["内存", bytes(memTot), memPct, `已用 ${m ? bytes(m.mem_used) : "—"}`, `可用 ${m && memTot >= m.mem_used ? bytes(memTot - m.mem_used) : "—"}`, ""],
        ["硬盘", bytes(diskTot), diskPct, `已用 ${m ? bytes(m.disk_used) : "—"}`, `剩余 ${m && diskTot >= m.disk_used ? bytes(diskTot - m.disk_used) : "—"}`, ""],
      ] as [string, string, number | null, string, string, string][],
      hardware: [
        ["CPU 型号", cpuName(node.cpu_name)], ["CPU 核心", node.cpu_cores && `${node.cpu_cores} 核`],
        ["架构 / 虚拟化", [node.arch, node.virt === "none" ? "" : node.virt].filter(Boolean).join(" / ")],
        ["操作系统", node.os], ["内核版本", node.kernel],
        ["物理内存 / Swap", bytes(node.mem_total) + (hasSwap ? ` / ${bytes(swapTot)}` : "")],
        ["磁盘总量", bytes(node.disk_total)], ["Agent 版本", node.agent_version],
        ...[["IP 地址", node.ip], ["主机名", node.hostname], ["备注", node.remark || node.public_remark]].filter(([, v]) => v),
      ] as [string, string | number | undefined][],
      billing: [
        ["当期上传 / 下载", `${bytes(node.month_tx)} / ${bytes(node.month_rx)}`],
        ["计费方向 / 重置日", (MODES[node.traffic_mode] ?? "双向合计") + (node.traffic_reset_day ? ` · 每月 ${node.traffic_reset_day} 日` : "")],
        ["累计上传 / 下载", `${bytes(node.total_tx)} / ${bytes(node.total_rx)}`],
        ...(showBilling ? [["录入标价", node.price > 0 ? priceFull(node.price, node.currency || "CNY", node.billing_cycle) : "免费 / 未设"]] : []),
        ["到期时间", node.expires_at ? `${node.expires_at} (${exp.text})` : exp.text || FOREVER],
      ] as [string, string][],
    }
  }
</script>

<script lang="ts">
  import { onMount } from "svelte"
  import ChartCard from "@/components/ChartCard.svelte"
  import BrandIcon from "@/components/BrandIcon.svelte"
  import CountryFlag from "@/components/CountryFlag.svelte"
  import { api } from "@/lib/api"
  import type { createApp } from "@/lib/app-state.svelte"
  import { rangesFor, rangeLabel, metricCharts, pingCharts, probeSelection, toggleProbe, readProbes, saveProbes, type MetricsResponse } from "@/lib/detail-series"
  import { osKey } from "@/lib/icons"

  let { node, app }: { node: Node; app: ReturnType<typeof createApp> } = $props()

  let switcherList = $derived(app.orderedNodes.length > 0 ? app.orderedNodes : [node])
  let currentIndex = $derived(switcherList.findIndex((n) => n.id === node.id))
  let prevNode = $derived(currentIndex > 0 ? switcherList[currentIndex - 1] : null)
  let nextNode = $derived(currentIndex >= 0 && currentIndex < switcherList.length - 1 ? switcherList[currentIndex + 1] : null)

  let rangeHoursList = $derived(rangesFor(app.historyDays))
  let selectedHours = $state(6)
  let showPeak = $state(false)
  $effect(() => { if (!rangeHoursList.includes(selectedHours)) selectedHours = rangeHoursList[0] ?? 24 })

  let chartHost: HTMLDivElement | undefined = $state()
  const bindHost = (el: HTMLDivElement) => { chartHost = el; return { destroy: () => { chartHost = undefined } } }
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
    metricsResp = pingResp = null
    metricErr = pingErr = ""
    if (resource) {
      const get = (q: string, ok: (d: MetricsResponse) => void, fail: (m: string) => void) =>
        void api<MetricsResponse>(resource + "&series=" + q).then((d) => cur && ok(d), (e) => cur && fail(errMsg(e)))
      get("metrics", (d) => { metricsResp = d; updatedAt = new Date().toLocaleTimeString("zh-CN", { hour12: false }) }, (m) => (metricErr = m))
      if (app.pingEnabled) get("ping", (d) => (pingResp = d), (m) => (pingErr = m))
    }
    return () => { cur = false }
  })

  let accentColor = $derived.by(() => { void app.config.theme; return readAccent() })
  let metrics = $derived(metricCharts(metricsResp, accentColor, showPeak, node.metrics?.mem_total || node.mem_total, node.metrics?.disk_total || node.disk_total))
  let ping = $derived(pingCharts(pingResp, accentColor))
  let saved = $state.raw(readProbes())
  let selection = $derived(probeSelection(ping.probes, saved))
  function choose(next: string[] | null) { saved = next; saveProbes(next) }

  let tapName = "", tapTime = 0
  function clickProbe(e: MouseEvent, name: string) {
    if (!name) { choose(null); return }
    const touch = (e as PointerEvent).pointerType === "touch"
    const twice = touch && tapName === name && e.timeStamp - tapTime < 400
    tapName = touch && !twice ? name : ""
    tapTime = e.timeStamp
    choose(toggleProbe(selection.names, selection.active, name, e.altKey || twice || e.detail === 2))
  }

  onMount(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || (e.target instanceof HTMLElement && e.target.closest("input,textarea,select,[contenteditable=true]"))) return
      const target = e.key === "ArrowLeft" ? prevNode : e.key === "ArrowRight" ? nextNode : null
      if (target) { e.preventDefault(); app.selectNode(target.id) }
    }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  })
</script>

{#if node}
{@const d = buildDetail(node, app.config.show_billing, app.config.expiry_warning_days)}
{@const fetchError = metricErr || pingErr}
<div class="d-stack">
  <div class="d-nav">
    <button type="button" onclick={() => app.back()} class="btn">← 返回</button>
    <div data-testid="node-switcher" class="d-switch">
      <span class="mono fg-subtle">{app.groupLabel} · {switcherList.length} 台</span>
      <button type="button" disabled={!prevNode} onclick={() => prevNode && app.selectNode(prevNode.id)} aria-label="上一个节点" class="btn step-btn">‹</button>
      <select aria-label="切换节点" value={node.id} onchange={(e) => { const id = Number((e.currentTarget as HTMLSelectElement).value); if (id && id !== node.id) app.selectNode(id) }} class="ctrl d-sel">
        {#each switcherList as item (item.id)}<option value={item.id}>{item.name}</option>{/each}
      </select>
      <button type="button" disabled={!nextNode} onclick={() => nextNode && app.selectNode(nextNode.id)} aria-label="下一个节点" class="btn step-btn">›</button>
    </div>
  </div>

  <section class="panel d-hero">
    <div class="min-w0">
      <div class="d-title">
        <i class="led {node.online ? '' : 'offline'}"></i>
        <h1>{node.name}</h1>
        <span class="tnum {node.online ? 'badge-online' : 'badge-offline'}">{d.statusText}</span>
        <span class="d-tag"><CountryFlag code={node.country} />{regionName(node.country) || "未知地区"}{node.group ? ` · ${node.group}` : ""}</span>
        {#if node.os}<span class="d-tag"><BrandIcon key={osKey(node.os)} size={12} title={node.os} />{node.os}</span>{/if}
      </div>
      <p class="mono d-sub">{d.hwSummary}</p>
    </div>
    <div data-testid="detail-stats" class="d-stats mono">
      {#each d.info as [lbl, val]}{#if val != null}<div><span>{lbl}</span><b>{val}</b></div>{/if}{/each}
    </div>
    {#if d.isCorrupt || d.isWaiting}
      <div data-testid={d.isCorrupt ? "status-unavailable" : "status-waiting"} class="nc-notice" style="grid-column:1 / -1">{d.isCorrupt ? "不可用" : "等待数据"}</div>
    {/if}
  </section>

  <section class="d-kpi">
    {#each d.kpis as [label, cap, pct, left, right, rCls] (label)}
      <div class="panel kpi-card">
        <div class="kpi-top"><span>{label}</span><span class="mono">{cap}</span></div>
        <div class="kpi-val mono">{pct == null ? "—" : pct.toFixed(1)}<small>{pct == null ? "" : "%"}</small></div>
        <i class="hbar {level(pct)}" style="--v:{Math.min(100, Math.max(0, pct ?? 0))}%;height:7px"></i>
        <div class="kpi-foot mono"><span>{left}</span><span class={rCls}>{right}</span></div>
      </div>
    {/each}
    <div class="panel kpi-card">
      <div class="kpi-top"><span>网络速率</span><span class="tx">实时</span></div>
      <div class="kpi-net-box mono"><span class="tx">↑ {speed(d.m?.net_tx ?? 0)}</span><span class="rx">↓ {speed(d.m?.net_rx ?? 0)}</span></div>
      <div class="kpi-foot mono">
        <span>本月 {node.traffic_limit > 0 ? pair(d.periodUsed, node.traffic_limit) : `${bytes(d.periodUsed)} / ${FOREVER}`}</span>
        <span>{node.traffic_limit > 0 ? `${d.trafficPct.toFixed(1)}%` : "不限"}</span>
      </div>
    </div>
  </section>

  <div class="d-stack" use:bindHost>
    <div class="trend-toolbar">
      <div class="trend-head">
        <h2>资源与延迟趋势</h2>
        <p class="mono">{showPeak ? "含区间峰值" : "历史平均值"}{updatedAt ? ` · 更新于 ${updatedAt}` : ""}</p>
      </div>
      <div class="scroll-hint range-scroll" role="group" aria-label="时间范围">
        <div class="range-track">
          {#each rangeHoursList as h (h)}
            <button type="button" data-testid="range-btn" aria-pressed={selectedHours === h} onclick={() => (selectedHours = h)} class="range-btn">{rangeLabel(h)}</button>
          {/each}
        </div>
      </div>
      <div class="trend-actions">
        <label class="desktop-peak"><input type="checkbox" checked={showPeak} onchange={(e) => (showPeak = (e.currentTarget as HTMLInputElement).checked)} /><span>显示峰值</span></label>
        <button type="button" class="mobile-peak trend-action btn" aria-label="显示峰值" title="显示峰值" aria-pressed={showPeak} onclick={() => (showPeak = !showPeak)}>峰值</button>
        <button type="button" aria-label="刷新" title="刷新" onclick={() => revision++} class="trend-action btn h28">刷新</button>
      </div>
    </div>

    {#if fetchError}
      <div class="panel d-msg fg-danger">读取历史数据失败：{fetchError}</div>
    {:else if !metricsResp && !pingResp}
      <div class="panel d-msg fg-subtle">正在加载图表数据…</div>
    {:else}
      <div class="charts-4">
        {#each metrics.slice(0, 4) as spec (spec.title)}
          <ChartCard {spec} subtitle={spec.title === "CPU 使用率" && d.m ? `${d.m.cpu.toFixed(1)}%` : spec.title === "网络速率" && d.m ? `↑ ${speed(d.m.net_tx)} · ↓ ${speed(d.m.net_rx)}` : ""} />
        {/each}
      </div>
      {#each metrics.slice(4) as spec (spec.title)}<ChartCard {spec} />{/each}
      {#if app.pingEnabled && ping.charts.length}
        <div class="charts-ping {selection.hasLoss ? 'two' : ''}">
          {#each ping.charts as spec, i (spec.title)}
            <div hidden={i === 1 && !selection.hasLoss} class="min-w0">
              <ChartCard {spec} show={selection.show} noLoss={i === 0 && selection.noLoss} probes={i === 0 && selection.names.length > 1 ? ping.probes : undefined} onProbe={clickProbe} />
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  <div class="spec-grid">
    {#each [["硬件与系统", d.hardware], ["流量与费用", d.billing]] as const as [title, fields]}
      <section class="panel spec-card">
        <h3>{title}</h3>
        {#if title === "流量与费用"}
          <div class="bill-box">
            <div class="bill-top"><span>当期计费流量</span><span class="mono">{node.traffic_limit > 0 ? `${pair(d.periodUsed, node.traffic_limit)} (${d.trafficPct.toFixed(1)}%)` : `${bytes(d.periodUsed)} / ${FOREVER}`}</span></div>
            <i class="hbar {level(d.trafficPct)}" style="--v:{Math.min(100, Math.max(0, d.trafficPct))}%;height:7px"></i>
          </div>
        {/if}
        <dl class="spec-dl">
          {#each fields as [lbl, val]}
            <div class="spec-item">
              <dt>{lbl}</dt>
              <dd class="mono {lbl === '到期时间' && d.exp.level === 'expired' ? 'fg-danger' : lbl === '到期时间' && d.exp.level === 'soon' ? 'fg-warn' : ''}">
                {#if lbl === "操作系统"}<BrandIcon key={osKey(node.os)} title={node.os} />{" "}{/if}{val || "—"}
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
  .d-switch { gap: 6px; font-size: 11.5px; }
  .d-sel { max-width: 200px; cursor: pointer; text-overflow: ellipsis; }
  .step-btn { width: 28px; padding: 0; }
  .min-w0 { min-width: 0; }
  .d-hero { padding: 14px 16px; display: grid; gap: 12px; align-items: center; }
  .d-title h1 { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
  .d-tag { display: inline-flex; align-items: center; gap: 5px; padding: 2px 7px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); font-size: 11px; color: var(--fg-muted); }
  .d-sub { margin-top: 6px; font-size: 11.5px; color: var(--fg-subtle); overflow-wrap: anywhere; }
  .d-stats { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; }
  .d-stats > div { padding: 6px 10px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--border-sub); white-space: nowrap; }
  .d-stats span { display: block; font-size: 10.5px; color: var(--fg-subtle); }
  .d-stats b { font-size: 12.5px; font-weight: 600; }
  .d-kpi, .charts-4, .charts-ping, .spec-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .kpi-card { padding: 13px 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px; }
  .kpi-top, .kpi-foot { display: flex; justify-content: space-between; gap: 6px; }
  .kpi-top { font-size: 12px; font-weight: 600; color: var(--fg-muted); }
  .kpi-val { font-size: 24px; font-weight: 700; line-height: 1.1; letter-spacing: -0.03em; }
  .kpi-val small { font-size: 12px; font-weight: 500; color: var(--fg-subtle); margin-left: 2px; }
  .kpi-net-box { display: flex; flex-direction: column; gap: 3px; font-size: 15px; font-weight: 700; }
  .kpi-foot { font-size: 11px; color: var(--fg-muted); white-space: nowrap; overflow: hidden; }
  .kpi-foot > span { overflow: hidden; text-overflow: ellipsis; }
  .trend-head { margin-right: auto; }
  .trend-head h2, .spec-card h3 { font-size: 14px; font-weight: 700; }
  .trend-head p { font-size: 11px; color: var(--fg-subtle); }
  .range-scroll { min-width: 0; max-width: 100%; overflow-x: auto; }
  .range-track { display: flex; width: max-content; gap: 4px; padding: 2px 0; }
  .range-btn { height: 28px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--fg-muted); font-weight: 500; cursor: pointer; white-space: nowrap; }
  .range-btn:hover { background: var(--surface-hover); color: var(--fg); }
  .range-btn[aria-pressed="true"] { background: var(--accent-strong); border-color: var(--accent-strong); color: #fff; font-weight: 600; }
  .desktop-peak { display: inline-flex; cursor: pointer; align-items: center; gap: 5px; color: var(--fg-muted); }
  .desktop-peak input { accent-color: var(--accent); }
  .h28 { height: 28px; }
  .d-msg { padding: 32px 16px; text-align: center; font-size: 12px; }
  .spec-card { padding: 14px; }
  .bill-box { margin-top: 10px; border-radius: 6px; border: 1px solid var(--accent-border); background: var(--accent-soft); padding: 9px 12px; display: flex; flex-direction: column; gap: 6px; }
  .bill-top { display: flex; justify-content: space-between; gap: 8px; font-weight: 600; color: var(--accent-text); }
  .spec-dl { margin-top: 10px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .spec-item { min-width: 0; border-radius: 6px; border: 1px solid var(--border-sub); background: var(--surface-2); padding: 8px 10px; }
  .spec-item dt { font-size: 11px; color: var(--fg-subtle); }
  .spec-item dd { margin-top: 2px; font-weight: 600; white-space: pre-line; overflow-wrap: break-word; }
  .mobile-peak { display: none; }
  @media (min-width: 640px) { .d-kpi, .spec-dl { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (min-width: 900px) { .d-hero { grid-template-columns: minmax(0, 1fr) auto; } .charts-4, .spec-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (min-width: 1024px) { .d-kpi { grid-template-columns: repeat(4, minmax(0, 1fr)); } .charts-ping.two { grid-template-columns: 1fr 1fr; } }
  @media (width < 640px) {
    .d-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
    .trend-toolbar { display: grid; grid-template-columns: minmax(0, 1fr) auto; }
    .trend-actions { grid-area: 1 / 2; }
    .range-scroll { grid-area: 2 / 1 / auto / -1; }
    .range-track button { min-width: 62px; min-height: 34px; padding-inline: 11px; }
    .desktop-peak { display: none; }
    .trend-action { display: inline-flex; height: 32px; padding: 0 9px; }
    .mobile-peak[aria-pressed="true"] { color: #fff; background: var(--accent-strong); border-color: transparent; }
  }
</style>
