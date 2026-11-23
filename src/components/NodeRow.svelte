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

  let n = $derived(view.node)
  let m = $derived(n.metrics)
  let exp = $derived(expiry(n, Date.now(), expiryWarningDays))
  let sample = $derived(ping.get(n.id))
  let latency = $derived(n.online ? sample?.latency : null)
  let loss = $derived(n.online ? sample?.loss : null)
  let state = $derived(snapshotOnly ? "状态待确认" : n.online ? "在线" : `离线 ${offlineFor(n) ?? ""}`)

  function latTone(v: number | null | undefined) {
    return v == null ? "text-[var(--fg-subtle)]" : v < 100 ? "text-[var(--online-fg)]" : v <= 200 ? "text-[var(--warn-fg)]" : "text-[var(--danger-fg)]"
  }
  function lossTone(v: number | null | undefined) {
    return v == null || v === 0 ? "text-[var(--fg-subtle)]" : v <= 5 ? "text-[var(--warn-fg)]" : "text-[var(--danger-fg)]"
  }
  function link(e: MouseEvent) {
    e.stopPropagation()
    if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    onSelect(n.id)
  }
</script>

<tr
  data-testid="node-row"
  use:observe
  use:watchPing={showPing && n.online ? n.id : 0}
  onclick={() => onSelect(n.id)}
  class="node-row cursor-pointer whitespace-nowrap transition-colors hover:bg-[var(--surface-hover)]"
>
  <td>
    <a href="/node/{n.id}" onfocus={prefetchDetail} onpointerenter={prefetchDetail} onclick={link} class="font-semibold text-[var(--fg)] hover:underline">
      {n.name}
    </a>
  </td>
  {#if view.painted}
    <td>
      <span class="inline-flex items-center gap-1.5 text-[var(--fg-muted)]">
        <CountryFlag code={n.country} />{regionName(n.country) || "—"}<BrandIcon key={osKey(n.os)} title={n.os || "未知系统"} />
      </span>
    </td>
    {#if n._corrupt || (n.online && !m)}
      <td colspan="3" class="text-[var(--fg-subtle)]" data-testid={n._corrupt ? "status-unavailable" : "status-waiting"}>
        {n._corrupt ? "不可用" : "等待数据"}
      </td>
    {:else}
      {#each [m?.cpu, m && percentNum(m.mem_used, m.mem_total), m && percentNum(m.disk_used, m.disk_total)] as pct}
        {@const tone = pct != null && pct >= 90 ? "danger" : pct != null && pct >= 80 ? "warn" : ""}
        <td>
          <span class={tone === "danger" ? "text-[var(--danger-fg)]" : tone === "warn" ? "text-[var(--warn-fg)]" : ""}>
            {pct == null ? "—" : `${pct.toFixed(1)}%`}
          </span>
          <i class="nc-bar mt-1 w-16 {tone}" style:--v="{Math.min(100, pct ?? 0)}%"></i>
        </td>
      {/each}
    {/if}
    <td class="tx">{speed(m?.net_tx ?? 0)}</td>
    <td class="rx">{speed(m?.net_rx ?? 0)}</td>
    {#if showPing}
      <td data-testid="node-ping" data-latency={latency ?? ""} data-loss={loss ?? ""} class={latTone(latency)} title={probeTitle(sample)}>{latencyText(latency)}</td>
      <td class={lossTone(loss)} title={probeTitle(sample)}>{lossText(loss)}</td>
    {/if}
    <td class="text-[var(--fg-muted)]">{n.traffic_limit > 0 ? pair(monthUsage(n), n.traffic_limit) : `${bytes(monthUsage(n))} / ${FOREVER}`}</td>
    <td>
      <div class={exp.level === "expired" ? "font-semibold text-[var(--danger-fg)]" : exp.level === "soon" ? "font-semibold text-[var(--warn-fg)]" : ""}>
        {exp.text || "长期"}
      </div>
      {#if showBilling && n.price > 0}
        <small class="text-[var(--fg-subtle)]">{priceShort(n.price, n.currency || "CNY", n.billing_cycle)}</small>
      {/if}
    </td>
    <td class="text-[var(--fg-muted)]">
      <i class="mr-1.5 inline-block h-2 w-2 rounded-full" style:background={!snapshotOnly && n.online ? "var(--online)" : "var(--offline)"}></i>{state}
    </td>
  {:else}
    <td colspan={showPing ? 11 : 9} style="height:44px"></td>
  {/if}
</tr>

<style>
  td { padding: 8px 12px; font-variant-numeric: tabular-nums; }
</style>
