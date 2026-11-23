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

  let headers = $derived(["名称", "地区", "CPU", "内存", "硬盘", "上行", "下行", ...(showPing ? ["延迟", "丢包"] : []), "本期流量", "到期", "状态"])
</script>

<div class="panel tbl-wrap">
  <table class="node-table">
    <thead>
      <tr>
        {#each headers as h}<th>{h}</th>{/each}
      </tr>
    </thead>
    <tbody>
      {#each nodes as node (node.id)}
        <NodeRow {node} defer={total > 60} {ping} {showPing} {snapshotOnly} {showBilling} {expiryWarningDays} {onSelect} />
      {/each}
      {#if total > nodes.length}
        <tr aria-hidden="true"><td colspan={headers.length} style="height:{44 * (total - nodes.length)}px"></td></tr>
      {/if}
    </tbody>
  </table>
</div>
