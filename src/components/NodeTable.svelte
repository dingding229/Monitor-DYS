<script lang="ts">
  import BrandIcon from "@/components/BrandIcon.svelte"
  import CountryFlag from "@/components/CountryFlag.svelte"
  import type { Node } from "@/lib/api"
  import { prefetchDetail } from "@/lib/detail"
  import {
    FOREVER,
    bytes,
    expiry,
    priceShort,
    offlineFor,
    osName,
    pair,
    percentNum,
    regionName,
    speed,
    uptime,
  } from "@/lib/format"
  import { osKey } from "@/lib/icons"

  let {
    nodes,
    showBilling = true,
    expiryWarningDays = 7,
    onSelect,
  }: {
    nodes: Node[]
    showBilling?: boolean
    expiryWarningDays?: number
    onSelect: (id: number) => void
  } = $props()

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

  function barColor(pct: number): string {
    if (pct >= 90) return "var(--danger)"
    if (pct >= 80) return "var(--warn)"
    return "var(--accent)"
  }

  function handleLinkClick(e: MouseEvent, id: number) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      e.stopPropagation()
      return
    }
    e.preventDefault()
    e.stopPropagation()
    onSelect(id)
  }
</script>

<div class="overflow-x-auto rounded-[8px] border border-neutral-200 bg-white">
  <table class="w-full border-collapse text-left text-[12px]">
    <thead class="sticky top-0 z-10 bg-neutral-50/95 backdrop-blur">
      <tr class="border-b border-neutral-200 text-neutral-500">
        <th class="whitespace-nowrap px-3 py-2.5 font-medium">状态</th>
        <th class="whitespace-nowrap px-3 py-2.5 font-medium">名称</th>
        <th class="whitespace-nowrap px-3 py-2.5 font-medium">地区</th>
        <th class="whitespace-nowrap px-3 py-2.5 font-medium">CPU</th>
        <th class="whitespace-nowrap px-3 py-2.5 font-medium">内存</th>
        <th class="whitespace-nowrap px-3 py-2.5 font-medium">硬盘</th>
        <th class="whitespace-nowrap px-3 py-2.5 font-medium">↑</th>
        <th class="whitespace-nowrap px-3 py-2.5 font-medium">↓</th>
        <th class="whitespace-nowrap px-3 py-2.5 font-medium">本期流量</th>
        <th class="whitespace-nowrap px-3 py-2.5 font-medium">到期</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-neutral-100">
      {#each nodes as node (node.id)}
        {@const m = node.metrics}
        {@const isCorrupt = Boolean(node._corrupt)}
        {@const isWaiting = node.online && !m && !isCorrupt}
        {@const exp = expiry(node, Date.now(), expiryWarningDays)}
        {@const offDur = !node.online ? offlineFor(node) : null}
        {@const memPct = m ? percentNum(m.mem_used, m.mem_total) : 0}
        {@const diskPct = m ? percentNum(m.disk_used, m.disk_total) : 0}
        {@const usedTraffic = monthUsage(node)}
        <tr
          data-testid="node-row"
          onclick={() => onSelect(node.id)}
          class="cursor-pointer transition-colors hover:bg-neutral-50"
        >
          <!-- 状态 -->
          <td class="tnum whitespace-nowrap px-3 py-2.5">
            <span class="inline-flex items-center gap-1.5">
              <span
                class="h-2 w-2 rounded-full"
                style="background-color: {node.online ? 'var(--online)' : 'var(--offline)'};"
              ></span>
              {#if node.online}
                <span class="text-neutral-700">{m ? uptime(m.uptime) : "在线"}</span>
              {:else}
                <span class="text-neutral-400">
                  离线{offDur ? ` (${offDur})` : ""}
                </span>
              {/if}
            </span>
          </td>

          <!-- 名称 (BrandIcon + <a href="/node/{id}">) -->
          <td class="px-3 py-2.5">
            <div class="flex items-center gap-1.5">
              <BrandIcon
                key={osKey(node.os)}
                kind="os"
                size={13}
                title={node.os || "未知系统"}
              />
              <a
                href="/node/{node.id}" onfocus={prefetchDetail} onpointerenter={prefetchDetail}
                onclick={(e) => handleLinkClick(e, node.id)}
                class="font-semibold text-neutral-900 hover:underline"
              >
                {node.name}
              </a>
              {#if node.os}
                <span class="text-[11px] text-neutral-400">{osName(node.os)}</span>
              {/if}
            </div>
            {#if node.public_remark}
              <div class="text-[11px] text-neutral-400">{node.public_remark}</div>
            {/if}
          </td>

          <!-- 地区 -->
          <td class="whitespace-nowrap px-3 py-2.5 text-neutral-600">
            <div class="inline-flex items-center gap-1.5">
              <CountryFlag code={node.country} />
              <span class="text-[11px]">{regionName(node.country) || "—"}</span>
            </div>
          </td>

          {#if isCorrupt}
            <td colspan="3" class="px-3 py-2.5 text-center text-neutral-400">
              <span data-testid="status-unavailable">不可用</span>
            </td>
          {:else if isWaiting}
            <td colspan="3" class="px-3 py-2.5 text-center text-neutral-400">
              <span data-testid="status-waiting">等待数据</span>
            </td>
          {:else}
            <!-- CPU -->
            <td class="tnum whitespace-nowrap px-3 py-2.5">
              <div class="w-20">
                <div class="flex justify-between text-[11px]">
                  <span class="font-medium text-neutral-800">{m ? `${m.cpu.toFixed(1)}%` : "—"}</span>
                </div>
                <div class="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    class="h-full rounded-full"
                    style="width: {m ? Math.min(100, m.cpu) : 0}%; background-color: {barColor(m ? m.cpu : 0)};"
                  ></div>
                </div>
              </div>
            </td>

            <!-- 内存 -->
            <td class="tnum whitespace-nowrap px-3 py-2.5">
              <div class="w-20">
                <div class="flex justify-between text-[11px]">
                  <span class="font-medium text-neutral-800">{m ? `${memPct.toFixed(1)}%` : "—"}</span>
                </div>
                <div class="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    class="h-full rounded-full"
                    style="width: {m ? Math.min(100, memPct) : 0}%; background-color: {barColor(memPct)};"
                  ></div>
                </div>
              </div>
            </td>

            <!-- 硬盘 -->
            <td class="tnum whitespace-nowrap px-3 py-2.5">
              <div class="w-20">
                <div class="flex justify-between text-[11px]">
                  <span class="font-medium text-neutral-800">{m ? `${diskPct.toFixed(1)}%` : "—"}</span>
                </div>
                <div class="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    class="h-full rounded-full"
                    style="width: {m ? Math.min(100, diskPct) : 0}%; background-color: {barColor(diskPct)};"
                  ></div>
                </div>
              </div>
            </td>
          {/if}

          <!-- ↑ -->
          <td class="tnum whitespace-nowrap px-3 py-2.5 font-medium text-emerald-600">
            {m ? speed(m.net_tx) : "0 B/s"}
          </td>

          <!-- ↓ -->
          <td class="tnum whitespace-nowrap px-3 py-2.5 font-medium text-sky-600">
            {m ? speed(m.net_rx) : "0 B/s"}
          </td>

          <!-- 本期流量 -->
          <td class="tnum whitespace-nowrap px-3 py-2.5 text-neutral-700">
            {node.traffic_limit > 0
              ? pair(usedTraffic, node.traffic_limit)
              : `${bytes(usedTraffic)} / ${FOREVER}`}
          </td>

          <!-- 到期 -->
          <td class="tnum whitespace-nowrap px-3 py-2.5">
            {#if exp.level !== "none"}
              <div
                class={exp.level === "expired"
                  ? "font-medium text-red-600"
                  : exp.level === "soon"
                    ? "font-medium text-amber-600"
                    : "text-neutral-700"}
              >
                {exp.text}
              </div>
            {:else}
              <div class="text-neutral-400">长期</div>
            {/if}
            {#if showBilling && node.price > 0}
              <div class="text-[11px] text-neutral-500">
                {priceShort(node.price, node.currency || "CNY", node.billing_cycle)}
              </div>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
