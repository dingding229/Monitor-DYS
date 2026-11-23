<script module lang="ts">
  import type { Node } from "@/lib/api"
  import type { PingSummary } from "@/lib/ping.svelte"
  import { monthUsage, FOREVER, bytes, expiry, priceShort, offlineFor, pair, percentNum, speed } from "@/lib/format"

  const BAR_SLOTS = Array.from({ length: 12 }, (_, i) => i)
  const level = (p: number | null) => (p === null ? "" : p >= 90 ? "danger" : p >= 80 ? "warn" : "")
  const cardUptime = (s: number) => (s >= 86400 ? `${Math.floor(s / 86400)} 天` : s >= 3600 ? `${Math.floor(s / 3600)} 时` : `${Math.floor(s / 60)} 分`)
  const barClass = (v: number | null | undefined, loss: boolean, on: boolean) => (!on || v == null ? "" : v <= (loss ? 0 : 99) ? "g" : v <= (loss ? 5 : 200) ? "w" : "d")

  export function sparkPts(vals: readonly number[], hi: number, w: number, h: number, pad: number, centerFlat = false): string {
    const n = vals.length, bot = h - pad
    if (n <= 1) { const y = centerFlat ? (h / 2).toFixed(1) : String(bot); return `0,${y} ${w},${y}` }
    const lo = centerFlat ? Math.min(...vals) : 0
    const span = hi - lo
    if (centerFlat && span < 1e-4) { const y = (h / 2).toFixed(1); return `0,${y} ${w},${y}` }
    const y = (v: number) => (bot - ((Math.min(hi, Math.max(lo, v)) - lo) / (span || 1)) * (bot - pad)).toFixed(1)
    return vals.map((v, i) => `${((i / (n - 1)) * w).toFixed(1)},${y(v)}`).join(" ")
  }

  function buildCard(node: Node, sample: PingSummary | undefined, snapshotOnly: boolean, showBilling: boolean, expiryWarningDays: number) {
    const m = node.metrics, isCorrupt = Boolean(node._corrupt), isWaiting = node.online && !m && !isCorrupt
    const exp = expiry(node, Date.now(), expiryWarningDays), used = monthUsage(node)
    const hasT = node.online || node.cpu_cores > 0 || node.mem_total > 0 || used > 0, lim = node.traffic_limit > 0
    const memTot = m?.mem_total || node.mem_total, diskTot = m?.disk_total || node.disk_total
    const memPct = m && memTot > 0 ? percentNum(m.mem_used, memTot) : null
    const diskPct = m && diskTot > 0 ? percentNum(m.disk_used, diskTot) : null
    const warn = node.online && (
      (m != null && (m.cpu >= 90 || (memPct != null && memPct >= 90) || (diskPct != null && diskPct >= 90))) ||
      (sample?.loss != null && sample.loss >= 5) ||
      (sample?.latency != null && sample.latency >= 200)
    )
    return {
      m, isCorrupt, isWaiting,
      ledCls: !node.online || snapshotOnly ? "offline" : warn ? "warn" : "",
      osTxt: node.os ? node.os.replace(/\s+GNU\/Linux/i, "") : "未知系统",
      duration: snapshotOnly ? "状态待确认" : node.online ? `在线${m ? " " + cardUptime(m.uptime) : ""}` : `离线 ${offlineFor(node) ?? ""}`,
      load1: m?.load?.[0] != null ? m.load[0].toFixed(2) : "—",
      meters: [
        ["CPU", m ? m.cpu : null, node.cpu_cores ? `${node.cpu_cores} 核` : "—", "—"],
        ["内存", memPct, m ? pair(m.mem_used, m.mem_total) : bytes(node.mem_total), "—"],
        ["硬盘", diskPct, m ? pair(m.disk_used, m.disk_total) : bytes(node.disk_total), "—"],
        ["流量", lim && hasT ? percentNum(used, node.traffic_limit) : null, !hasT ? "—" : lim ? pair(used, node.traffic_limit) : `${bytes(used)} / ${FOREVER}`, !hasT ? "—" : lim ? "0.0%" : FOREVER],
      ] as [string, number | null, string, string][],
      f0: `↑\u202f${speed(m?.net_tx ?? 0).replace(" ", "")}`,
      f1: `↑\u202f${bytes(node.month_tx ?? m?.month_tx ?? 0)}`,
      f3: `↓\u202f${speed(m?.net_rx ?? 0).replace(" ", "")}`,
      f4: `↓\u202f${bytes(node.month_rx ?? m?.month_rx ?? 0)}`,
      expTxt: exp.level === "none" ? "长期" : exp.days !== null && exp.days > 0 ? `剩余 ${exp.days} 天` : exp.text,
      expCls: exp.level === "expired" ? "danger" : exp.level === "soon" ? "warn" : "",
      price: showBilling && node.price > 0 ? priceShort(node.price, node.currency || "CNY", node.billing_cycle) : showBilling ? "—" : "",
    }
  }
</script>

<script lang="ts">
  import { freezeNode } from "@/lib/viewport.svelte"
  import BrandIcon from "@/components/BrandIcon.svelte"
  import CountryFlag from "@/components/CountryFlag.svelte"
  import { probeTitle } from "@/lib/ping.svelte"
  import type { createApp } from "@/lib/app-state.svelte"
  import { prefetchDetail } from "@/lib/detail"
  import { osKey } from "@/lib/icons"

  let { node: incoming, defer = false, app, showPing }: {
    node: Node; defer?: boolean; app: ReturnType<typeof createApp>; showPing: boolean
  } = $props()

  const view = freezeNode(() => incoming, () => defer)
  const observeView = view.observe
  const observePing = (el: Element, id: number) => app.ping.observe(el, id)
</script>

<a
  href="/node/{view.node.id}"
  use:observeView
  use:observePing={showPing && view.node.online ? view.node.id : 0}
  data-testid="node-card"
  data-status={!app.snapshotOnly && view.node.online ? "online" : "offline"}
  onclick={(e) => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); app.selectNode(view.node.id) } }}
  onpointerenter={prefetchDetail}
  onfocus={prefetchDetail}
  class="nc"
>
  {#if !view.painted}
    <div class="nc-stub">{view.node.name}</div>
  {:else}
    {@const node = view.node}
    {@const sample = showPing && node.online ? app.ping.get(node.id) : undefined}
    {@const c = buildCard(node, sample, app.snapshotOnly, app.config.show_billing, app.config.expiry_warning_days)}
    {@const loadArr = (void app.history.version, app.history.load(node.id))}

    <div class="nc-top">
      <div class="nc-id"><i class="led {c.ledCls}"></i><h3 class="nc-name" title={node.name}>{node.name}</h3></div>
      <CountryFlag code={node.country} />
    </div>

    <div class="nc-sub">
      <BrandIcon key={osKey(node.os)} kind="os" size={13} title={node.os || "未知系统"} />
      <span class="nc-os" title={node.os || "未知系统"}>{c.osTxt}</span><span aria-hidden="true">·</span><span class="nc-up tnum">{c.duration}</span>
    </div>

    <div class="nc-viz">
      {#if c.isCorrupt || c.isWaiting}
        <div data-testid={c.isCorrupt ? "status-unavailable" : "status-waiting"} class="nc-notice">{c.isCorrupt ? "不可用" : "等待数据"}</div>
      {:else}
        <div class="m-grid">
          {#each c.meters as [label, pct, foot, empty]}
            {@const tone = level(pct)}
            <div class="m-item">
              <span class="m-lbl">{label}</span>
              <b class="m-val mono {tone}">{pct === null ? empty : `${pct.toFixed(1)}%`}</b>
              <i class="hbar {tone}" style="--v:{pct === null ? 0 : Math.min(100, Math.max(0, pct))}%"></i>
              <small class="m-sub mono" title={foot}>{foot}</small>
            </div>
          {/each}
        </div>
        <div class="spark-row">
          <span class="spark-lbl">负载</span>
          <svg class="spark-svg" data-testid="load-spark" viewBox="0 0 154 16" preserveAspectRatio="none" aria-hidden="true">
            <polyline fill="none" stroke={node.online ? "var(--accent)" : "var(--offline)"} stroke-width="1.6" points={sparkPts(loadArr, Math.max(0.1, ...loadArr), 154, 16, 2.5, true)} />
          </svg>
          <span class="spark-lbl mono">{c.load1}</span>
        </div>
      {/if}
    </div>

    <div class="nc-foot">
      <span class="nc-fl">实时速率</span><span class="nc-fl">当期流量</span><span class="nc-fl">到期</span>
      <b class="nc-fv mono tx">{c.f0}</b><b class="nc-fv mono">{c.f1}</b><b class="nc-fv tnum {c.expCls}">{c.expTxt}</b>
      <b class="nc-fv mono rx">{c.f3}</b><b class="nc-fv mono">{c.f4}</b><b class="nc-fv tnum muted">{c.price}</b>
    </div>

    {#if showPing}
      {@const offset = (sample?.buckets.length ?? 0) - 12}
      <div class="nc-ping {!node.online || sample?.latency == null ? 'muted' : ''}" data-testid="node-ping" data-latency={sample?.latency ?? ""} data-loss={sample?.loss ?? ""} title={node.online ? probeTitle(sample) : "节点离线"}>
        <div class="ping-caption">延迟 ms{" "}<b class="nc-pv mono">{node.online && sample?.latency != null ? Math.round(sample.latency) : "—"}</b></div>
        <div class="ping-caption nc-pr">丢包 %{" "}<b class="nc-pv mono">{node.online && sample?.loss != null ? sample.loss.toFixed(1) : "—"}</b></div>
        {#each [false, true] as isLoss}
          <div data-testid="ping-bars" class="nc-pbars {isLoss ? 'nc-pr' : ''}" aria-hidden="true">
            {#each BAR_SLOTS as i}<i class={barClass(isLoss ? sample?.buckets[i + offset]?.loss : sample?.buckets[i + offset]?.latency, isLoss, node.online)}></i>{/each}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</a>
