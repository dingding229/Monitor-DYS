<script lang="ts">
  import CountryFlag from "@/components/CountryFlag.svelte"
  import Meter from "@/components/Meter.svelte"
  import type { Node } from "@/lib/api"
  import {
    bytes,
    cycleLabel,
    cycleMonths,
    expiry,
    money,
    offlineFor,
    osName,
    pair,
    speed,
    uptime,
  } from "@/lib/format"

  let {
    node,
    showBilling = true,
    onSelect,
  }: {
    node: Node
    showBilling?: boolean
    onSelect: (id: number) => void
  } = $props()

  let m = $derived(node.metrics)
  let isCorrupt = $derived(Boolean(node._corrupt))
  let isWaiting = $derived(node.online && !m && !isCorrupt)
  let offlineDuration = $derived(!node.online ? offlineFor(node) : null)
  let exp = $derived(expiry(node))

  let billingText = $derived.by(() => {
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
    return `${formattedPrice} / ${label}`
  })

  let monthlyEquiv = $derived.by(() => {
    if (!showBilling || typeof node.price !== "number" || node.price <= 0) return ""
    const months = cycleMonths(node.billing_cycle)
    if (Number.isNaN(months) || months <= 1) return ""
    return `约 ${money(node.price / months, node.currency || "CNY")}/月`
  })

  let sysVirt = $derived(
    [osName(node.os), node.virt && node.virt !== "none" ? node.virt : "", node.arch]
      .filter(Boolean)
      .join(" · ") || "未知系统",
  )

  let publicRemark = $derived(typeof node.public_remark === "string" ? node.public_remark.trim() : "")
</script>

<div
  data-testid="node-card"
  role="button"
  tabindex="0"
  onclick={() => onSelect(node.id)}
  onkeydown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(node.id))}
  class="group flex min-w-0 cursor-pointer flex-col justify-between rounded-[12px] border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-600"
>
  <div>
    <!-- Header: Flag + Name + Status dot -->
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <CountryFlag code={node.country} />
          <h3
            class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100"
            title={node.name}
          >
            {node.name}
          </h3>
        </div>
        <p class="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400" title={sysVirt}>
          {sysVirt}
        </p>
      </div>

      <div class="flex shrink-0 flex-col items-end gap-1">
        <span class="tnum inline-flex items-center gap-1.5 text-xs font-medium">
          <span
            class="h-2 w-2 rounded-full"
            style="background-color: {node.online ? 'var(--online)' : 'var(--offline)'};"
          ></span>
          {#if node.online}
            <span class="text-neutral-700 dark:text-neutral-300">
              {m ? uptime(m.uptime) : "在线"}
            </span>
          {:else}
            <span class="text-neutral-500 dark:text-neutral-400">
              离线{offlineDuration ? ` · ${offlineDuration}` : ""}
            </span>
          {/if}
        </span>

        {#if showBilling && exp.level !== "none" && exp.text}
          <span
            class="tnum text-[11px] {exp.level === 'expired'
              ? 'font-medium text-red-600 dark:text-red-400'
              : exp.level === 'soon'
                ? 'font-medium text-amber-600 dark:text-amber-400'
                : 'text-neutral-400 dark:text-neutral-500'}"
          >
            {exp.text}
          </span>
        {/if}
      </div>
    </div>

    <!-- Body: Status notice or 3 thin progress bars -->
    {#if isCorrupt}
      <div
        data-testid="status-unavailable"
        class="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-5 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-400"
      >
        不可用
      </div>
    {:else if isWaiting}
      <div
        data-testid="status-waiting"
        class="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-5 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-400"
      >
        等待数据
      </div>
    {:else}
      <div class="mt-4 space-y-3 {!node.online ? 'opacity-60' : ''}">
        <Meter
          label="CPU {node.cpu_cores ? `${node.cpu_cores} 核` : ''}"
          pct={m ? m.cpu : null}
          foot={m ? `负载 ${m.load.map((v) => v.toFixed(2)).join(" / ")}` : ""}
        />
        <Meter
          label="内存"
          used={m?.mem_used}
          total={m?.mem_total || node.mem_total}
          foot={m ? pair(m.mem_used, m.mem_total) : bytes(node.mem_total)}
        />
        <Meter
          label="硬盘"
          used={m?.disk_used}
          total={m?.disk_total || node.disk_total}
          foot={m ? pair(m.disk_used, m.disk_total) : bytes(node.disk_total)}
        />
      </div>
    {/if}
  </div>

  <!-- Footer: Speed, cumulative traffic, billing & public_remark -->
  <div class="mt-4 border-t border-neutral-100 pt-3 text-xs dark:border-neutral-800/80">
    <div class="tnum grid grid-cols-2 gap-2 text-neutral-700 dark:text-neutral-300">
      <div class="truncate" title="实时下行速率">↓ {m ? speed(m.net_rx) : "0 B/s"}</div>
      <div class="truncate" title="实时上行速率">↑ {m ? speed(m.net_tx) : "0 B/s"}</div>
    </div>
    <div class="tnum mt-1 grid grid-cols-2 gap-2 text-[11px] text-neutral-400 dark:text-neutral-500">
      <div class="truncate" title="累计下行流量">总 ↓ {bytes(node.total_rx ?? m?.total_rx ?? 0)}</div>
      <div class="truncate" title="累计上行流量">总 ↑ {bytes(node.total_tx ?? m?.total_tx ?? 0)}</div>
    </div>

    {#if (showBilling && billingText) || publicRemark}
      <div class="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2 text-[11px] text-neutral-500 dark:border-neutral-800/60 dark:text-neutral-400">
        {#if showBilling && billingText}
          <span class="tnum truncate" title={monthlyEquiv}>
            {billingText}{monthlyEquiv ? ` (${monthlyEquiv})` : ""}
          </span>
        {/if}
        {#if publicRemark}
          <span class="truncate text-neutral-500 dark:text-neutral-400" title={publicRemark}>
            {publicRemark}
          </span>
        {/if}
      </div>
    {/if}
  </div>
</div>
