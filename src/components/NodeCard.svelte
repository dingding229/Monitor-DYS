<script lang="ts">
  import BrandIcon from "@/components/BrandIcon.svelte"
  import CountryFlag from "@/components/CountryFlag.svelte"
  import Meter from "@/components/Meter.svelte"
  import type { Node } from "@/lib/api"
  import { prefetchDetail } from "@/lib/detail"
  import {
    FOREVER,
    bytes,
    expiry,
    priceShort,
    offlineFor,
    pair,
    percentNum,
    speed,
    uptime,
  } from "@/lib/format"
  import { osKey } from "@/lib/icons"

  let {
    node,
    showBilling = true,
    expiryWarningDays = 7,
    onSelect,
  }: {
    node: Node
    showBilling?: boolean
    expiryWarningDays?: number
    onSelect: (id: number) => void
  } = $props()

  let m = $derived(node.metrics)
  let isCorrupt = $derived(Boolean(node._corrupt))
  let isWaiting = $derived(node.online && !m && !isCorrupt)
  let offlineDuration = $derived(!node.online ? offlineFor(node) : null)
  let exp = $derived(expiry(node, Date.now(), expiryWarningDays))

  function monthUsage(n: Node): number {
    if (typeof n.month_used === "number") return n.month_used
    const rx = typeof n.month_rx === "number" ? n.month_rx : (n.metrics?.month_rx ?? 0)
    const tx = typeof n.month_tx === "number" ? n.month_tx : (n.metrics?.month_tx ?? 0)
    switch (n.traffic_mode) {
      case "up":
        return tx
      case "down":
        return rx
      case "max":
        return Math.max(rx, tx)
      default:
        return rx + tx
    }
  }

  let periodUsed = $derived(monthUsage(node))
  let hasTrafficData = $derived(
    node.online || (node.cpu_cores > 0 || node.mem_total > 0) || periodUsed > 0,
  )
  let trafficPct = $derived(
    node.traffic_limit > 0 && hasTrafficData ? percentNum(periodUsed, node.traffic_limit) : null,
  )
  let trafficEmpty = $derived(
    !hasTrafficData ? "—" : node.traffic_limit > 0 ? "0.0%" : FOREVER,
  )
  let trafficFoot = $derived(
    !hasTrafficData
      ? "—"
      : node.traffic_limit > 0
        ? pair(periodUsed, node.traffic_limit)
        : `${bytes(periodUsed)} / ${FOREVER}`,
  )

  let billingPrice = $derived(showBilling && node.price > 0
    ? priceShort(node.price, node.currency || "CNY", node.billing_cycle) : "—")

  let publicRemark = $derived(typeof node.public_remark === "string" ? node.public_remark.trim() : "")

  function handleClick(e: MouseEvent) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return
    }
    e.preventDefault()
    onSelect(node.id)
  }
</script>

<a
  href="/node/{node.id}"
  data-testid="node-card"
  onclick={handleClick} onpointerenter={prefetchDetail} onfocus={prefetchDetail}
  class="glass-panel node-card group flex min-w-0 cursor-pointer flex-col justify-between rounded-[8px] border border-neutral-200 bg-white p-[12px] text-inherit no-underline transition-colors hover:border-neutral-400"
>
  <div>
    <!-- 1. Title Row: Status dot + Name + OS BrandIcon + Flag -->
    <div class="flex items-center justify-between gap-2">
      <div class="flex min-w-0 items-center gap-2">
        <span class="relative inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
          {#if node.online}
            <span class="absolute inline-flex h-3.5 w-3.5 rounded-full opacity-20" style="background-color: var(--online);"></span>
          {/if}
          <span
            class="h-2 w-2 rounded-full"
            style="background-color: {node.online ? 'var(--online)' : 'var(--offline)'};"
          ></span>
        </span>
        <h3
          class="truncate text-[13px] font-bold text-neutral-900"
          title={node.name}
        >
          {node.name}
        </h3>
      </div>

      <div class="flex shrink-0 items-center gap-1.5">
        <BrandIcon
          key={osKey(node.os)}
          kind="os"
          size={14}
          title={node.os || "未知系统"}
        />
        <CountryFlag code={node.country} />
      </div>
    </div>

    <!-- 2. Tag Row (small capsules): Online/Offline duration + Price/cycle (+ remark if any) -->
    <div class="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
      <span class="tnum inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
        {#if node.online}
          在线 {m ? uptime(m.uptime) : ""}
        {:else}
          离线{offlineDuration ? ` · ${offlineDuration}` : ""}
        {/if}
      </span>


      {#if publicRemark}
        <span
          class="max-w-[120px] truncate rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-500"
          title={publicRemark}
        >
          {publicRemark}
        </span>
      {/if}
    </div>

    <!-- 3. 2x2 Metric Grid or Status Notice -->
    {#if isCorrupt}
      <div
        data-testid="status-unavailable"
        class="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-6 text-center text-[12px] text-neutral-500"
      >
        不可用
      </div>
    {:else if isWaiting}
      <div
        data-testid="status-waiting"
        class="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-6 text-center text-[12px] text-neutral-500"
      >
        等待数据
      </div>
    {:else}
      <div class="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 {!node.online ? 'opacity-65' : ''}">
        <Meter
          icon="cpu"
          label="CPU"
          pct={m ? m.cpu : null}
          foot={m ? m.load.map((v) => v.toFixed(2)).join(", ") : "—"}
        />
        <Meter
          icon="mem"
          label="内存"
          used={m?.mem_used}
          total={m?.mem_total || node.mem_total}
          foot={m ? pair(m.mem_used, m.mem_total) : bytes(node.mem_total)}
        />
        <Meter
          icon="disk"
          label="硬盘"
          used={m?.disk_used}
          total={m?.disk_total || node.disk_total}
          foot={m ? pair(m.disk_used, m.disk_total) : bytes(node.disk_total)}
        />
        <Meter
          icon="traffic"
          label="本期流量"
          pct={trafficPct}
          empty={trafficEmpty}
          foot={trafficFoot}
        />
      </div>
    {/if}
  </div>

  <!-- 4. Bottom 3 Columns (Per SPEC-v1.2 §3: no border/bg boxes, separated by 1px border-t, 12px grey label + 2 rows of 13px tabular-nums values) -->
  <div class="mt-3 grid grid-cols-3 gap-2 border-t border-neutral-200 pt-2.5 text-left">
    <!-- Col 1: 实时速率 -->
    <div class="min-w-0">
      <div class="text-[12px] text-neutral-400">实时速率</div>
      <div class="tnum mt-0.5 truncate text-[13px] font-medium text-emerald-600" title="上行速率">
        ↑ {m ? speed(m.net_tx) : "0 B/s"}
      </div>
      <div class="tnum truncate text-[13px] font-medium text-sky-600" title="下行速率">
        ↓ {m ? speed(m.net_rx) : "0 B/s"}
      </div>
    </div>

    <!-- Col 2: 当期流量 -->
    <div class="min-w-0">
      <div class="text-[12px] text-neutral-400">当期流量</div>
      <div class="tnum mt-0.5 truncate text-[13px] font-medium text-neutral-700" title="本期上行">
        ↑ {bytes(node.month_tx ?? m?.month_tx ?? 0)}
      </div>
      <div class="tnum truncate text-[13px] font-medium text-neutral-700" title="本期下行">
        ↓ {bytes(node.month_rx ?? m?.month_rx ?? 0)}
      </div>
    </div>

    <!-- Col 3: 到期 -->
    <div class="min-w-0">
      <div class="text-[12px] text-neutral-400">到期</div>
      <div
        class="tnum mt-0.5 [overflow-wrap:anywhere] text-[13px] font-medium {exp.level === 'expired'
          ? 'text-red-600'
          : exp.level === 'soon'
            ? 'text-amber-600'
            : 'text-neutral-700'}"
        title={exp.text || "长期有效"}
      >
        {#if exp.level === "none"}
          长期
        {:else if exp.days !== null && exp.days > 0}
          剩余 {exp.days} 天
        {:else}
          {exp.text}
        {/if}
      </div>
      {#if showBilling}
        <div
          class="tnum [overflow-wrap:anywhere] text-[12px] font-medium text-neutral-600"
          title={billingPrice}
        >
          {billingPrice}
        </div>
      {/if}
    </div>
  </div>
</a>
