<script lang="ts">
  import { freezeNode } from "@/lib/viewport.svelte"
  import BrandIcon from "@/components/BrandIcon.svelte"
  import CountryFlag from "@/components/CountryFlag.svelte"
  import PingPanel from "./PingPanel.svelte"
  import type { PingStore } from "@/lib/ping.svelte"
  import type { Node } from "@/lib/api"
  import { prefetchDetail } from "@/lib/detail"
  import {
    monthUsage, FOREVER, bytes, expiry, priceShort, offlineFor, pair, percentNum, speed,
  } from "@/lib/format"
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

  let node = $derived(view.node)
  let m = $derived(node.metrics)
  let isCorrupt = $derived(Boolean(node._corrupt))
  let isWaiting = $derived(node.online && !m && !isCorrupt)
  let offlineDuration = $derived(!node.online ? offlineFor(node) : null)
  let exp = $derived(expiry(node, Date.now(), expiryWarningDays))

  let periodUsed = $derived(monthUsage(node))
  let hasTrafficData = $derived(node.online || node.cpu_cores > 0 || node.mem_total > 0 || periodUsed > 0)
  let limited = $derived(node.traffic_limit > 0)
  let trafficPct = $derived(limited && hasTrafficData ? percentNum(periodUsed, node.traffic_limit) : null)
  let trafficEmpty = $derived(!hasTrafficData ? "—" : limited ? "0.0%" : FOREVER)
  let trafficFoot = $derived(!hasTrafficData ? "—" : limited ? pair(periodUsed, node.traffic_limit) : `${bytes(periodUsed)} / ${FOREVER}`)
  let billingPrice = $derived(showBilling && node.price > 0 ? priceShort(node.price, node.currency || "CNY", node.billing_cycle) : "—")

  let sample = $derived(ping.get(node.id))
  function cardUptime(seconds: number) {
    if (seconds >= 86400) return `${Math.floor(seconds / 86400)} 天`
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)} 时`
    return `${Math.floor(seconds / 60)} 分`
  }
  let duration = $derived(snapshotOnly ? "状态待确认" : node.online ? `在线${m ? " " + cardUptime(m.uptime) : ""}` : `离线 ${offlineDuration ?? ""}`)
  let expiryText = $derived(exp.level === "none" ? "长期" : exp.days !== null && exp.days > 0 ? `剩余 ${exp.days} 天` : exp.text)

  let memPct = $derived(m && (m.mem_total || node.mem_total) > 0 ? percentNum(m.mem_used, m.mem_total || node.mem_total) : null)
  let diskPct = $derived(m && (m.disk_total || node.disk_total) > 0 ? percentNum(m.disk_used, m.disk_total || node.disk_total) : null)

  function level(pct: number | null) {
    return pct === null ? "" : pct >= 90 ? "danger" : pct >= 80 ? "warn" : ""
  }

  function handleClick(e: MouseEvent) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    onSelect(node.id)
  }
</script>

{#snippet meter(label: string, pct: number | null, foot: string, empty = "—")}
  {@const tone = level(pct)}
  {@const width = pct === null ? 0 : Math.min(100, Math.max(0, pct))}
  <div class="nc-m">
    <span class="nc-ml">{label}</span>
    <b class="nc-mv tnum {tone}">{pct === null ? empty : `${pct.toFixed(1)}%`}</b>
    <i class="nc-bar {tone}" style:--v="{width}%"></i>
    <small class="nc-ms tnum" title={foot}>{foot}</small>
  </div>
{/snippet}

<a
  href="/node/{node.id}"
  use:observeView
  use:observePing={showPing && node.online ? node.id : 0}
  data-testid="node-card"
  data-status={!snapshotOnly && node.online ? "online" : "offline"}
  onclick={handleClick}
  onpointerenter={prefetchDetail}
  onfocus={prefetchDetail}
  class="nc"
>
  {#if !view.painted}
    <div style="min-height:228px">{node.name}</div>
  {:else}
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
        {@render meter("内存", memPct, m ? pair(m.mem_used, m.mem_total) : bytes(node.mem_total))}
        {@render meter("硬盘", diskPct, m ? pair(m.disk_used, m.disk_total) : bytes(node.disk_total))}
        {@render meter("本期流量", trafficPct, trafficFoot, trafficEmpty)}
      </div>
    {/if}

    <div class="nc-foot">
      <span class="nc-fl">实时速率</span>
      <span class="nc-fl">当期流量</span>
      <span class="nc-fl">到期</span>
      <b class="nc-fv tnum tx" title="↑ {speed(m?.net_tx ?? 0)}">↑&#8239;{speed(m?.net_tx ?? 0).replace(" ", "")}</b>
      <b class="nc-fv tnum" title="↑ {bytes(node.month_tx ?? m?.month_tx ?? 0)}">↑&#8239;{bytes(node.month_tx ?? m?.month_tx ?? 0)}</b>
      <b class="nc-fv tnum {exp.level === 'expired' ? 'danger' : exp.level === 'soon' ? 'warn' : ''}" title={expiryText}>{expiryText}</b>
      <b class="nc-fv tnum rx" title="↓ {speed(m?.net_rx ?? 0)}">↓&#8239;{speed(m?.net_rx ?? 0).replace(" ", "")}</b>
      <b class="nc-fv tnum" title="↓ {bytes(node.month_rx ?? m?.month_rx ?? 0)}">↓&#8239;{bytes(node.month_rx ?? m?.month_rx ?? 0)}</b>
      <b class="nc-fv tnum muted" title={showBilling ? billingPrice : ""}>{showBilling ? billingPrice : ""}</b>
    </div>

    {#if showPing && node.online}
      <PingPanel {sample} />
    {/if}
  {/if}
</a>
