<script module lang="ts">
  function latTone(v: number | null | undefined) {
    return v == null ? "fg-subtle" : v < 100 ? "fg-online" : v <= 200 ? "fg-warn" : "fg-danger"
  }
  function lossTone(v: number | null | undefined) {
    return v == null || v === 0 ? "fg-subtle" : v <= 5 ? "fg-warn" : "fg-danger"
  }
</script>

<script lang="ts">
  import BrandIcon from "./BrandIcon.svelte"
  import CountryFlag from "./CountryFlag.svelte"
  import { freezeNode } from "@/lib/viewport.svelte"
  import { latencyText, lossText, probeTitle, type PingStore } from "@/lib/ping.svelte"
  import { percentNum, expiry, offlineFor, priceShort, regionName, monthUsage, bytes, FOREVER, pair, speed } from "@/lib/format"
  import { prefetchDetail } from "@/lib/detail"
  import { osKey } from "@/lib/icons"
  import type { Node } from "@/lib/api"

  let { node: incoming, defer, ping, showPing, snapshotOnly, showBilling, expiryWarningDays, onSelect }: {
    node: Node
    defer: boolean
    ping: PingStore
    showPing: boolean
    snapshotOnly: boolean
    showBilling: boolean
    expiryWarningDays: number
    onSelect: (id: number) => void
  } = $props()

  const view = freezeNode(() => incoming, () => defer)
  const observe = view.observe
  const watchPing = (el: Element, id: number) => ping.observe(el, id)
</script>

<tr
  data-testid="node-row"
  use:observe
  use:watchPing={showPing && view.node.online ? view.node.id : 0}
  onclick={() => onSelect(view.node.id)}
  class="node-row"
>
  <td>
    <a
      href="/node/{view.node.id}"
      onfocus={prefetchDetail}
      onpointerenter={prefetchDetail}
      onclick={(e) => {
        e.stopPropagation()
        if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        onSelect(view.node.id)
      }}
      class="row-link"
    >
      {view.node.name}
    </a>
  </td>
  {#if view.painted}
    {@const n = view.node}
    {@const m = n.metrics}
    {@const exp = expiry(n, Date.now(), expiryWarningDays)}
    {@const sample = ping.get(n.id)}
    {@const latency = n.online ? sample?.latency : null}
    {@const loss = n.online ? sample?.loss : null}
    {@const state = snapshotOnly ? "状态待确认" : n.online ? "在线" : `离线 ${offlineFor(n) ?? ""}`}
    {@const price = showBilling && n.price > 0 ? priceShort(n.price, n.currency || "CNY", n.billing_cycle) : ""}
    {@const expLabel = exp.text || "长期"}
    <td>
      <span class="row-region">
        <CountryFlag code={n.country} />{regionName(n.country) || "—"}<BrandIcon key={osKey(n.os)} title={n.os || "未知系统"} />
      </span>
    </td>
    {#if n._corrupt || (n.online && !m)}
      <td colspan="3" class="fg-subtle" data-testid={n._corrupt ? "status-unavailable" : "status-waiting"}>
        {n._corrupt ? "不可用" : "等待数据"}
      </td>
    {:else}
      {#each [m?.cpu, m && percentNum(m.mem_used, m.mem_total), m && percentNum(m.disk_used, m.disk_total)] as pct}
        {@const tone = pct != null && pct >= 90 ? "danger" : pct != null && pct >= 80 ? "warn" : ""}
        <td>
          <span class={tone ? `fg-${tone}` : ""}>{pct == null ? "—" : `${pct.toFixed(1)}%`}</span>
          <i class="hbar row-bar {tone}" style="--v:{Math.min(100, pct ?? 0)}%"></i>
        </td>
      {/each}
    {/if}
    <td class="tx">{speed(m?.net_tx ?? 0)}</td>
    <td class="rx">{speed(m?.net_rx ?? 0)}</td>
    {#if showPing}
      <td data-testid="node-ping" data-latency={latency ?? ""} data-loss={loss ?? ""} class={latTone(latency)} title={probeTitle(sample)}>{latencyText(latency)}</td>
      <td class={lossTone(loss)} title={probeTitle(sample)}>{lossText(loss)}</td>
    {/if}
    <td class="fg-muted">{n.traffic_limit > 0 ? pair(monthUsage(n), n.traffic_limit) : `${bytes(monthUsage(n))} / ${FOREVER}`}</td>
    <td class="row-exp" title={price ? `${expLabel} · ${price}` : expLabel}>
      <span class={exp.level === "expired" ? "fg-danger fw6" : exp.level === "soon" ? "fg-warn fw6" : ""}>{expLabel}</span>
    </td>
    <td class="fg-muted">
      <i class="status-dot" style="background:{!snapshotOnly && n.online ? 'var(--online)' : 'var(--offline)'}"></i>{state}
    </td>
  {:else}
    <td colspan={showPing ? 11 : 9} class="row-stub"></td>
  {/if}
</tr>
