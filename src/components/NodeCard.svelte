<script lang="ts">
  import CountryFlag from "@/components/CountryFlag.svelte"
  import Meter from "@/components/Meter.svelte"
  import type { Node } from "@/lib/api"
  import { remainingValue } from "@/lib/finance"
  import {
    FOREVER,
    bytes,
    cycleLabel,
    cycleMonths,
    expiry,
    money,
    offlineFor,
    osName,
    pair,
    percentNum,
    speed,
    uptime,
  } from "@/lib/format"

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
  let remVal = $derived(remainingValue(node))

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

  let billingCapsule = $derived.by(() => {
    if (!showBilling) return ""
    if (typeof node.price !== "number" || node.price <= 0) return ""
    const formattedPrice = money(node.price, node.currency || "CNY")
    const months = cycleMonths(node.billing_cycle)
    const label = cycleLabel(node.billing_cycle)
    if (Number.isNaN(months)) {
      return label ? `${formattedPrice} / ${label}` : formattedPrice
    }
    if (months === 0) {
      return `${formattedPrice} · 一次性`
    }
    return `${formattedPrice} / ${label.replace(/付$/, "")}`
  })

  let osShort = $derived.by(() => {
    const clean = osName(node.os)
    if (!clean) return ""
    const low = clean.toLowerCase()
    if (low.includes("debian")) return "D"
    if (low.includes("ubuntu")) return "U"
    if (low.includes("alpine")) return "A"
    if (low.includes("centos")) return "C"
    if (low.includes("rocky")) return "R"
    if (low.includes("alma")) return "A"
    if (low.includes("arch")) return "A"
    if (low.includes("fedora")) return "F"
    if (low.includes("windows")) return "W"
    return clean.slice(0, 1).toUpperCase()
  })

  let osBadgeColor = $derived.by(() => {
    const low = (node.os || "").toLowerCase()
    if (low.includes("debian")) return "bg-rose-50 text-rose-600 border-rose-200"
    if (low.includes("ubuntu")) return "bg-orange-50 text-orange-600 border-orange-200"
    if (low.includes("alpine") || low.includes("arch")) return "bg-sky-50 text-sky-600 border-sky-200"
    if (low.includes("rocky") || low.includes("alma")) return "bg-emerald-50 text-emerald-600 border-emerald-200"
    return "bg-neutral-100 text-neutral-600 border-neutral-200"
  })

  let publicRemark = $derived(typeof node.public_remark === "string" ? node.public_remark.trim() : "")
</script>

<div
  data-testid="node-card"
  role="button"
  tabindex="0"
  onclick={() => onSelect(node.id)}
  onkeydown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(node.id))}
  class="group flex min-w-0 cursor-pointer flex-col justify-between rounded-[10px] border border-neutral-200 bg-white p-[12px] transition-colors hover:border-neutral-400"
>
  <div>
    <!-- 1. Title Row: Status dot + Name + OS initial badge + Flag -->
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
        {#if osShort}
          <span
            title={[osName(node.os), node.virt && node.virt !== "none" ? node.virt : "", node.arch].filter(Boolean).join(" · ")}
            class="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold {osBadgeColor}"
          >
            {osShort}
          </span>
        {/if}
        <CountryFlag code={node.country} />
      </div>
    </div>

    <!-- 2. Tag Row (small capsules): Online/Offline duration + Price/cycle (+ remark if any) -->
    <div class="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
      <span class="tnum inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
        {#if node.online}
          在线 {m ? uptime(m.uptime) : ""}
        {:else}
          离线{offlineDuration ? ` · ${offlineDuration}` : ""}
        {/if}
      </span>

      {#if showBilling && billingCapsule}
        <span class="tnum inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
          {billingCapsule}
        </span>
      {/if}

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

  <!-- 4. Bottom 3 Mini Tiles: 实时速率 / 当期流量 / 到期与价值 -->
  <div class="mt-3 grid grid-cols-3 gap-1.5 text-[11px]">
    <!-- Box 1: 实时速率 -->
    <div class="rounded-lg border border-neutral-100 bg-neutral-50/80 p-1.5">
      <div class="text-[10px] text-neutral-400">实时速率</div>
      <div class="tnum mt-0.5 truncate font-medium text-emerald-600" title="上行速率">
        ↑ {m ? speed(m.net_tx) : "0 B/s"}
      </div>
      <div class="tnum truncate font-medium text-sky-600" title="下行速率">
        ↓ {m ? speed(m.net_rx) : "0 B/s"}
      </div>
    </div>

    <!-- Box 2: 当期流量 -->
    <div class="rounded-lg border border-neutral-100 bg-neutral-50/80 p-1.5">
      <div class="text-[10px] text-neutral-400">当期流量</div>
      <div class="tnum mt-0.5 truncate font-medium text-neutral-700" title="本期上行">
        ↑ {bytes(node.month_tx ?? m?.month_tx ?? 0)}
      </div>
      <div class="tnum truncate font-medium text-neutral-700" title="本期下行">
        ↓ {bytes(node.month_rx ?? m?.month_rx ?? 0)}
      </div>
    </div>

    <!-- Box 3: 到期与价值 -->
    <div class="rounded-lg border border-neutral-100 bg-neutral-50/80 p-1.5">
      <div class="text-[10px] text-neutral-400">{showBilling ? "到期与价值" : "到期"}</div>
      <div
        class="tnum mt-0.5 truncate font-medium {exp.level === 'expired'
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
          data-testid="remaining-value"
          class="tnum truncate font-medium text-neutral-600"
          title="剩余价值"
        >
          {remVal !== null ? money(remVal, node.currency || "CNY") : "—"}
        </div>
      {/if}
    </div>
  </div>
</div>
