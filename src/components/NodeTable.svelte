<script lang="ts">
  import NodeRow from "./NodeRow.svelte"
  import type { Node } from "@/lib/api"
  import type { PingStore } from "@/lib/ping.svelte"

  let { nodes, total, ping, showPing, snapshotOnly, showBilling, expiryWarningDays, onSelect }: {
    nodes: Node[]
    total: number
    ping: PingStore
    showPing: boolean
    snapshotOnly: boolean
    showBilling: boolean
    expiryWarningDays: number
    onSelect: (id: number) => void
  } = $props()

  let headers = $derived(["名称", "地区", "CPU", "内存", "硬盘", "↑", "↓", ...(showPing ? ["延迟", "丢包"] : []), "本期流量", "到期", "状态"])
</script>

<div class="panel overflow-x-auto">
  <table class="w-full border-collapse text-left text-[12px]">
    <thead class="sticky top-0 z-10 bg-[var(--surface-subtle)]">
      <tr class="border-b border-[var(--border)] text-[var(--fg-muted)]">
        {#each headers as h}
          <th class="whitespace-nowrap px-3 py-2.5 font-medium">{h}</th>
        {/each}
      </tr>
    </thead>
    <tbody class="divide-y divide-[var(--border-subtle)]">
      {#each nodes as node (node.id)}
        <NodeRow {node} defer={total > 60} {ping} {showPing} {snapshotOnly} {showBilling} {expiryWarningDays} {onSelect} />
      {/each}
      {#if total > nodes.length}
        <tr aria-hidden="true"><td colspan={headers.length} style:height="{44 * (total - nodes.length)}px"></td></tr>
      {/if}
    </tbody>
  </table>
</div>
