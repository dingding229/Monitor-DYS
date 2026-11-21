<script lang="ts">
  import CountryFlag from "@/components/CountryFlag.svelte"
  import type { Node } from "@/lib/api"
  import {
    bytes,
    cycleLabel,
    cycleMonths,
    expiry,
    money,
    offlineFor,
    osName,
    percentNum,
    speed,
    uptime,
  } from "@/lib/format"

  let {
    nodes,
    showBilling = true,
    onSelect,
  }: {
    nodes: Node[]
    showBilling?: boolean
    onSelect: (id: number) => void
  } = $props()

  function formatBilling(node: Node): string {
    if (typeof node.price !== "number" || node.price <= 0) return ""
    const p = money(node.price, node.currency || "CNY")
    const m = cycleMonths(node.billing_cycle)
    if (Number.isNaN(m)) return p
    return `${p}/${cycleLabel(node.billing_cycle)}`
  }
</script>

<div class="overflow-x-auto rounded-[12px] border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
  <table class="w-full border-collapse text-left text-xs">
    <thead>
      <tr class="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        <th class="px-4 py-3 font-medium">节点</th>
        <th class="px-3 py-3 font-medium">状态</th>
        <th class="px-3 py-3 font-medium">系统</th>
        <th class="px-3 py-3 font-medium">CPU</th>
        <th class="px-3 py-3 font-medium">内存</th>
        <th class="px-3 py-3 font-medium">硬盘</th>
        <th class="px-3 py-3 font-medium">网络速率</th>
        <th class="px-3 py-3 font-medium">累计流量</th>
        {#if showBilling}
          <th class="px-4 py-3 font-medium">到期 / 价格</th>
        {/if}
      </tr>
    </thead>
    <tbody class="divide-y divide-neutral-100 dark:divide-neutral-800/70">
      {#each nodes as node (node.id)}
        {@const m = node.metrics}
        {@const isCorrupt = Boolean(node._corrupt)}
        {@const isWaiting = node.online && !m && !isCorrupt}
        {@const exp = expiry(node)}
        {@const offDur = !node.online ? offlineFor(node) : null}
        {@const memPct = m ? percentNum(m.mem_used, m.mem_total) : 0}
        {@const diskPct = m ? percentNum(m.disk_used, m.disk_total) : 0}
        <tr
          data-testid="node-row"
          role="button"
          tabindex="0"
          onclick={() => onSelect(node.id)}
          onkeydown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(node.id))}
          class="cursor-pointer transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
        >
          <td class="px-4 py-3">
            <div class="flex items-center gap-2">
              <CountryFlag code={node.country} />
              <span class="font-medium text-neutral-900 dark:text-neutral-100">{node.name}</span>
            </div>
            {#if node.public_remark}
              <div class="mt-0.5 text-[11px] text-neutral-400 dark:text-neutral-500">
                {node.public_remark}
              </div>
            {/if}
          </td>

          <td class="tnum whitespace-nowrap px-3 py-3">
            <span class="inline-flex items-center gap-1.5">
              <span
                class="h-2 w-2 rounded-full"
                style="background-color: {node.online ? 'var(--online)' : 'var(--offline)'};"
              ></span>
              {#if node.online}
                <span class="text-neutral-700 dark:text-neutral-300">{m ? uptime(m.uptime) : "在线"}</span>
              {:else}
                <span class="text-neutral-400 dark:text-neutral-500">
                  离线{offDur ? ` (${offDur})` : ""}
                </span>
              {/if}
            </span>
          </td>

          <td class="whitespace-nowrap px-3 py-3 text-neutral-600 dark:text-neutral-400">
            {[osName(node.os), node.virt && node.virt !== "none" ? node.virt : ""].filter(Boolean).join(" · ") || "—"}
          </td>

          {#if isCorrupt}
            <td colspan="3" class="px-3 py-3 text-center text-neutral-400">
              <span data-testid="status-unavailable">不可用</span>
            </td>
          {:else if isWaiting}
            <td colspan="3" class="px-3 py-3 text-center text-neutral-400">
              <span data-testid="status-waiting">等待数据</span>
            </td>
          {:else}
            <td class="tnum whitespace-nowrap px-3 py-3">
              <div class="w-20">
                <div class="flex justify-between text-[11px]">
                  <span>{m ? `${Math.round(m.cpu)}%` : "—"}</span>
                </div>
                <div class="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <div
                    class="h-full rounded-full"
                    style="width: {m ? Math.min(100, m.cpu) : 0}%; background-color: var(--accent);"
                  ></div>
                </div>
              </div>
            </td>

            <td class="tnum whitespace-nowrap px-3 py-3">
              <div class="w-20">
                <div class="flex justify-between text-[11px]">
                  <span>{m ? `${Math.round(memPct)}%` : "—"}</span>
                </div>
                <div class="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <div
                    class="h-full rounded-full"
                    style="width: {m ? Math.min(100, memPct) : 0}%; background-color: var(--accent);"
                  ></div>
                </div>
              </div>
            </td>

            <td class="tnum whitespace-nowrap px-3 py-3">
              <div class="w-20">
                <div class="flex justify-between text-[11px]">
                  <span>{m ? `${Math.round(diskPct)}%` : "—"}</span>
                </div>
                <div class="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <div
                    class="h-full rounded-full"
                    style="width: {m ? Math.min(100, diskPct) : 0}%; background-color: var(--accent);"
                  ></div>
                </div>
              </div>
            </td>
          {/if}

          <td class="tnum whitespace-nowrap px-3 py-3 text-neutral-700 dark:text-neutral-300">
            <div>↓ {m ? speed(m.net_rx) : "0 B/s"}</div>
            <div class="text-neutral-400">↑ {m ? speed(m.net_tx) : "0 B/s"}</div>
          </td>

          <td class="tnum whitespace-nowrap px-3 py-3 text-neutral-600 dark:text-neutral-400">
            <div>↓ {bytes(node.total_rx ?? 0)}</div>
            <div>↑ {bytes(node.total_tx ?? 0)}</div>
          </td>

          {#if showBilling}
            <td class="tnum whitespace-nowrap px-4 py-3">
              {#if exp.level !== "none"}
                <div
                  class={exp.level === "expired"
                    ? "font-medium text-red-600 dark:text-red-400"
                    : exp.level === "soon"
                      ? "font-medium text-amber-600 dark:text-amber-400"
                      : "text-neutral-600 dark:text-neutral-400"}
                >
                  {exp.text}
                </div>
              {/if}
              {#if formatBilling(node)}
                <div class="text-[11px] text-neutral-400 dark:text-neutral-500">{formatBilling(node)}</div>
              {/if}
            </td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
