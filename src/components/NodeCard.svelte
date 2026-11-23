<script module lang="ts">
  import type { PingSummary } from "@/lib/ping.svelte"

  function cardUptime(s: number) {
    return s >= 86400 ? `${Math.floor(s / 86400)} 天` : s >= 3600 ? `${Math.floor(s / 3600)} 时` : `${Math.floor(s / 60)} 分`
  }
  function level(pct: number | null) {
    return pct === null ? "" : pct >= 90 ? "danger" : pct >= 80 ? "warn" : ""
  }
  function formatProbes(sample: PingSummary | undefined, key: "latency" | "loss") {
    if (!sample) return "…"
    if (!sample.probes.length) return "—"
    return sample.probes
      .slice(0, 3)
      .map((p) => {
        const v = p[key]
        return v == null ? "—" : key === "loss" ? String(Number(v.toFixed(1))) : String(Math.round(v))
      })
      .join("·")
  }
  function barClass(v: number | null | undefined, loss: boolean) {
    return v == null ? "" : v <= (loss ? 0 : 99) ? "g" : v <= (loss ? 5 : 200) ? "w" : "d"
  }
  const BAR_SLOTS = Array.from({ length: 12 }, (_, i) => i)
</script>

<script lang="ts">
  import { freezeNode } from "@/lib/viewport.svelte"
  import BrandIcon from "@/components/BrandIcon.svelte"
  import CountryFlag from "@/components/CountryFlag.svelte"
  import { probeTitle, type PingStore } from "@/lib/ping.svelte"
  import type { Node } from "@/lib/api"
  import { prefetchDetail } from "@/lib/detail"
  import { monthUsage, FOREVER, bytes, expiry, priceShort, offlineFor, pair, percentNum, speed } from "@/lib/format"
  import { osKey } from "@/lib/icons"

  let {
    node: incoming,
    defer = false,
    ping,
    showPing,
    snapshotOnly,
    showBilling = true,
    expiryWarningDays = 7,
    onSelect,
  }: {
    node: Node
    defer?: boolean
    ping: PingStore
    snapshotOnly: boolean
    showPing: boolean
    showBilling?: boolean
    expiryWarningDays?: number
    onSelect: (id: number) => void
  } = $props()

  const view = freezeNode(() => incoming, () => defer)
  const observeView = view.observe
  const observePing = (el: Element, id: number) => ping.observe(el, id)
</script>

{#snippet meter(label: string, pct: number | null, foot: string, empty = "—")}
  {@const tone = level(pct)}
  <div class="nc-m">
    <span class="nc-ml">{label}</span>
    <b class="nc-mv tnum {tone}">{pct === null ? empty : `${pct.toFixed(1)}%`}</b>
    <i class="nc-bar {tone}" style:--v="{pct === null ? 0 : Math.min(100, Math.max(0, pct))}%"></i>
    <small class="nc-ms tnum" title={foot}>{foot}</small>
  </div>
{/snippet}

<a
  href="/node/{view.node.id}"
  use:observeView
  use:observePing={showPing && view.node.online ? view.node.id : 0}
  data-testid="node-card"
  data-status={!snapshotOnly && view.node.online ? "online" : "offline"}
  onclick={(e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    onSelect(view.node.id)
  }}
  onpointerenter={prefetchDetail}
  onfocus={prefetchDetail}
  class="nc"
>
  {#if !view.painted}
    <div class="nc-stub">{view.node.name}</div>
  {:else}
    {@const node = view.node}
    {@const m = node.metrics}
    {@const isCorrupt = Boolean(node._corrupt)}
    {@const isWaiting = node.online && !m && !isCorrupt}
    {@const exp = expiry(node, Date.now(), expiryWarningDays)}
    {@const periodUsed = monthUsage(node)}
    {@const hasTraffic = node.online || node.cpu_cores > 0 || node.mem_total > 0 || periodUsed > 0}
    {@const limited = node.traffic_limit > 0}
    {@const trafficPct = limited && hasTraffic ? percentNum(periodUsed, node.traffic_limit) : null}
    {@const duration = snapshotOnly ? "状态待确认" : node.online ? `在线${m ? " " + cardUptime(m.uptime) : ""}` : `离线 ${offlineFor(node) ?? ""}`}
    {@const expiryText = exp.level === "none" ? "长期" : exp.days !== null && exp.days > 0 ? `剩余 ${exp.days} 天` : exp.text}
    {@const billingPrice = showBilling && node.price > 0 ? priceShort(node.price, node.currency || "CNY", node.billing_cycle) : "—"}
    {@const memTotal = m?.mem_total || node.mem_total}
    {@const diskTotal = m?.disk_total || node.disk_total}
    {@const txStr = speed(m?.net_tx ?? 0)}
    {@const rxStr = speed(m?.net_rx ?? 0)}
    {@const mtxStr = bytes(node.month_tx ?? m?.month_tx ?? 0)}
    {@const mrxStr = bytes(node.month_rx ?? m?.month_rx ?? 0)}

    <div class="nc-head">
      <h3 class="nc-name" title={node.name}>{node.name}</h3>
      <BrandIcon key={osKey(node.os)} kind="os" size={14} title={node.os || "未知系统"} />
      <CountryFlag code={node.country} />
    </div>

    <div class="nc-sub tnum" title={duration}>{duration}</div>

    {#if isCorrupt || isWaiting}
      <div data-testid={isCorrupt ? "status-unavailable" : "status-waiting"} class="nc-notice">
        {isCorrupt ? "不可用" : "等待数据"}
      </div>
    {:else}
      <div class="nc-metrics">
        {@render meter("CPU", m ? m.cpu : null, m ? m.load.map((v) => v.toFixed(2)).join(", ") : "—")}
        {@render meter("内存", m && memTotal > 0 ? percentNum(m.mem_used, memTotal) : null, m ? pair(m.mem_used, m.mem_total) : bytes(node.mem_total))}
        {@render meter("硬盘", m && diskTotal > 0 ? percentNum(m.disk_used, diskTotal) : null, m ? pair(m.disk_used, m.disk_total) : bytes(node.disk_total))}
        {@render meter("本期流量", trafficPct, !hasTraffic ? "—" : limited ? pair(periodUsed, node.traffic_limit) : `${bytes(periodUsed)} / ${FOREVER}`, !hasTraffic ? "—" : limited ? "0.0%" : FOREVER)}
      </div>
    {/if}

    <div class="nc-foot">
      <span class="nc-fl">实时速率</span>
      <span class="nc-fl">当期流量</span>
      <span class="nc-fl">到期</span>
      <b class="nc-fv tnum tx" title="↑ {txStr}">↑&#8239;{txStr.replace(" ", "")}</b>
      <b class="nc-fv tnum" title="↑ {mtxStr}">↑&#8239;{mtxStr}</b>
      <b class="nc-fv tnum {exp.level === 'expired' ? 'danger' : exp.level === 'soon' ? 'warn' : ''}" title={expiryText}>{expiryText}</b>
      <b class="nc-fv tnum rx" title="↓ {rxStr}">↓&#8239;{rxStr.replace(" ", "")}</b>
      <b class="nc-fv tnum" title="↓ {mrxStr}">↓&#8239;{mrxStr}</b>
      <b class="nc-fv tnum muted" title={showBilling ? billingPrice : ""}>{showBilling ? billingPrice : ""}</b>
    </div>

    {#if showPing && node.online}
      {@const sample = ping.get(node.id)}
      {@const offset = (sample?.buckets.length ?? 0) - 12}
      <div
        class="nc-ping"
        class:pending={!sample?.probes.length}
        data-testid="node-ping"
        data-latency={sample?.latency ?? ""}
        data-loss={sample?.loss ?? ""}
        title={probeTitle(sample)}
      >
        <div class="ping-caption">延迟 ms{" "}<b class="nc-pv tnum">{formatProbes(sample, "latency")}</b></div>
        <div class="ping-caption nc-pr">丢包 %{" "}<b class="nc-pv tnum">{formatProbes(sample, "loss")}</b></div>
        <div data-testid="ping-bars" class="nc-pbars" aria-hidden="true">
          {#each BAR_SLOTS as i}<i class={barClass(sample?.buckets[i + offset]?.latency, false)}></i>{/each}
        </div>
        <div data-testid="ping-bars" class="nc-pbars nc-pr" aria-hidden="true">
          {#each BAR_SLOTS as i}<i class={barClass(sample?.buckets[i + offset]?.loss, true)}></i>{/each}
        </div>
      </div>
    {/if}
  {/if}
</a>
