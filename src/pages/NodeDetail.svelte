<script lang="ts">
  import DetailHistory from "@/components/DetailHistory.svelte"
  import BrandIcon from "@/components/BrandIcon.svelte"
  import CountryFlag from "@/components/CountryFlag.svelte"
  import type { Node } from "@/lib/api"
  import {
    monthUsage, FOREVER, bytes, cpuName, expiry, priceFull, offlineFor, pair, percentNum, regionName, speed, uptime,
  } from "@/lib/format"
  import { osKey } from "@/lib/icons"

  let {
    node,
    showPing,
    orderedNodes = [],
    groupLabel = "全部节点",
    historyDays = 7,
    showBilling = true,
    expiryWarningDays = 7,
    accent = "#10b981",
    onBack,
    onSelectNode,
  }: {
    node: Node
    showPing: boolean
    orderedNodes?: Node[]
    groupLabel?: string
    historyDays?: number
    showBilling?: boolean
    expiryWarningDays?: number
    accent?: string
    onBack: () => void
    onSelectNode?: (id: number) => void
  } = $props()

  let switcherList = $derived(orderedNodes.length > 0 ? orderedNodes : [node])
  let currentIndex = $derived(switcherList.findIndex((n) => n.id === node.id))
  let prevNode = $derived(currentIndex > 0 ? switcherList[currentIndex - 1] : null)
  let nextNode = $derived(currentIndex >= 0 && currentIndex < switcherList.length - 1 ? switcherList[currentIndex + 1] : null)

  let m = $derived(node.metrics)
  let isCorrupt = $derived(Boolean(node._corrupt))
  let isWaiting = $derived(node.online && !m && !isCorrupt)
  let offDur = $derived(!node.online ? offlineFor(node) : null)
  let exp = $derived(expiry(node, Date.now(), expiryWarningDays))

  let lastSeenSec = $derived.by(() => {
    if ("last_seen_ago" in node && node.last_seen_ago !== undefined) return node.last_seen_ago
    if (node.last_seen && node.last_seen > 0) return Math.max(0, Math.floor(Date.now() / 1000 - node.last_seen))
    return null
  })

  let hasSwap = $derived(
    (typeof node.swap_total === "number" && node.swap_total > 0) ||
      (typeof m?.swap_total === "number" && m.swap_total > 0),
  )

  let info = $derived([
    ["负载 1/5/15m", m?.load.map((v) => v.toFixed(2)).join(" / ") ?? "—"],
    ["Swap", hasSwap ? (m?.swap_used != null && m.swap_total != null ? pair(m.swap_used, m.swap_total) : bytes(node.swap_total ?? 0)) : null],
    ["进程", m?.procs],
    ["TCP / UDP", m?.tcp != null || m?.udp != null ? `${m?.tcp ?? "—"} / ${m?.udp ?? "—"}` : null],
    ["系统运行", m ? uptime(m.uptime) : "—"],
  ])

  let periodUsed = $derived(monthUsage(node))
  let trafficPct = $derived(node.traffic_limit > 0 ? percentNum(periodUsed, node.traffic_limit) : 0)

  const modes: Record<string, string> = { up: "仅上传", down: "仅下载", max: "单向取大" }
  let stats = $derived([
    { label: "CPU", cap: node.cpu_cores ? `${node.cpu_cores} 核` : "—", pct: m?.cpu, note: `负载 ${m?.load[0]?.toFixed(2) ?? "—"}` },
    { label: "内存", cap: bytes(m?.mem_total || node.mem_total), pct: m && percentNum(m.mem_used, m.mem_total), note: m ? pair(m.mem_used, m.mem_total) : bytes(node.mem_total) },
    { label: "硬盘", cap: bytes(m?.disk_total || node.disk_total), pct: m && percentNum(m.disk_used, m.disk_total), note: m ? pair(m.disk_used, m.disk_total) : bytes(node.disk_total) },
  ])

  let hardware = $derived([
    ["CPU 型号", cpuName(node.cpu_name)],
    ["CPU 核心", node.cpu_cores && `${node.cpu_cores} 核`],
    ["架构 / 虚拟化", [node.arch, node.virt === "none" ? "" : node.virt].filter(Boolean).join(" / ")],
    ["系统", node.os],
    ["内核", node.kernel],
    ["物理内存 / Swap", bytes(node.mem_total) + (hasSwap ? ` / ${bytes(node.swap_total || m?.swap_total || 0)}` : "")],
    ["磁盘总量", bytes(node.disk_total)],
    ["Agent 版本", node.agent_version],
    ...[["IP 地址", node.ip], ["主机名", node.hostname], ["备注", node.remark || node.public_remark]].filter(([, v]) => v),
  ])

  let billing = $derived([
    ["当期上传 / 下载", `${bytes(node.month_tx)} / ${bytes(node.month_rx)}`],
    ["计费方向 / 重置日", (modes[node.traffic_mode] ?? "双向合计") + (node.traffic_reset_day ? ` · 每月 ${node.traffic_reset_day} 日` : "")],
    ["累计上传 / 下载", `${bytes(node.total_tx)} / ${bytes(node.total_rx)}`],
    ...(showBilling ? [["录入标价", node.price > 0 ? priceFull(node.price, node.currency || "CNY", node.billing_cycle) : "免费 / 未设"]] : []),
    ["到期时间", node.expires_at ? `${node.expires_at} (${exp.text})` : exp.text || FOREVER],
  ])

  function level(pct: number | null | undefined) {
    return pct == null ? "" : pct >= 90 ? "danger" : pct >= 80 ? "warn" : ""
  }

  function keyboard(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && event.target.closest("input,textarea,select,[contenteditable=true]"))) return
    const target = event.key === "ArrowLeft" ? prevNode : event.key === "ArrowRight" ? nextNode : null
    if (target) {
      event.preventDefault()
      onSelectNode?.(target.id)
    }
  }
</script>

<svelte:window onkeydown={keyboard} />

<div class="space-y-3">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <button type="button" onclick={onBack} class="btn">← 返回列表</button>

    <div data-testid="node-switcher" class="flex flex-wrap items-center gap-1.5 text-[12px]">
      <span class="tnum text-[var(--fg-muted)]">{groupLabel} · {switcherList.length} 台</span>
      {@render stepButton(prevNode, "上一个节点", "‹")}
      <select
        aria-label="切换节点"
        value={node.id}
        onchange={(e) => {
          const nextId = Number((e.currentTarget as HTMLSelectElement).value)
          if (nextId && nextId !== node.id) onSelectNode?.(nextId)
        }}
        class="ctrl max-w-[200px] cursor-pointer text-ellipsis"
      >
        {#each switcherList as item (item.id)}
          <option value={item.id}>{item.name}</option>
        {/each}
      </select>
      {@render stepButton(nextNode, "下一个节点", "›")}
    </div>
  </div>

  <div class="panel p-3.5">
    <div class="node-identity">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <CountryFlag code={node.country} />
          <h1 class="text-[18px] font-bold tracking-tight text-[var(--fg)]">{node.name}</h1>
          <span class="tnum {node.online ? 'badge-online' : 'badge-offline'}">
            <span class="h-2 w-2 rounded-full" style:background-color={node.online ? "var(--online)" : "var(--offline)"}></span>
            {node.online ? "在线" : `离线${offDur ? ` · ${offDur}` : ""}`}
          </span>
        </div>

        <p class="tnum mt-1 text-[12px] text-[var(--fg-subtle)]">
          {[regionName(node.country) || "未知地区", node.group || "未分组", lastSeenSec === null ? "从未上报" : `最近上报 ${lastSeenSec} 秒前`].join(" · ")}
        </p>
      </div>

      <div data-testid="detail-stats" class="detail-stats tnum">
        {#each info as [label, value]}
          {#if value != null}
            <div>
              <span class="text-[var(--fg-subtle)]">{label}</span>
              <span class="ml-1.5 font-semibold text-[var(--fg)]">{value}</span>
            </div>
          {/if}
        {/each}
      </div>
    </div>

    {#if isCorrupt || isWaiting}
      <div data-testid={isCorrupt ? "status-unavailable" : "status-waiting"} class="nc-notice">
        {isCorrupt ? "不可用" : "等待数据"}
      </div>
    {/if}
  </div>

  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {#each stats as stat}
      {@const tone = level(stat.pct)}
      <section class="panel p-3">
        <div class="flex justify-between text-[12px] text-[var(--fg-muted)]"><span>{stat.label}</span><span class="tnum">{stat.cap}</span></div>
        <div class="kpi-mid my-2 flex flex-wrap items-baseline justify-between gap-1">
          <strong class="tnum text-[22px] font-bold tracking-tight text-[var(--fg)]">{stat.pct == null ? "—" : `${stat.pct.toFixed(1)}%`}</strong>
          <small class="tnum text-[11px] text-[var(--fg-subtle)]">{stat.note}</small>
        </div>
        <i class="nc-bar {tone}" style:--v="{Math.min(100, Math.max(0, stat.pct ?? 0))}%"></i>
      </section>
    {/each}
    <section class="panel p-3">
      <div class="flex justify-between text-[12px] text-[var(--fg-muted)]"><span>网络速率</span><span>实时</span></div>
      <p class="tnum tx mt-2 text-[14px] font-semibold">↑ {speed(m?.net_tx ?? 0)}</p>
      <p class="tnum rx mt-0.5 text-[14px] font-semibold">↓ {speed(m?.net_rx ?? 0)}</p>
    </section>
  </div>

  <DetailHistory {node} {accent} {historyDays} {showPing} />

  <div class="grid gap-3 lg:grid-cols-2">
    {#each [["硬件与系统", hardware], ["流量与费用", billing]] as const as [title, fields]}
      <section class="panel p-3.5">
        <h3 class="text-[14px] font-bold text-[var(--fg)]">{title}</h3>
        {#if title === "流量与费用"}
          <div class="mt-2.5 rounded-[6px] border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-2 text-[12px]">
            <div class="mb-1.5 flex items-center justify-between gap-2 font-medium text-[var(--fg)]">
              <span>当期计费流量</span>
              <span class="tnum">{node.traffic_limit > 0 ? `${pair(periodUsed, node.traffic_limit)} (${trafficPct.toFixed(1)}%)` : `${bytes(periodUsed)} / ${FOREVER}`}</span>
            </div>
            <i class="nc-bar {level(trafficPct)}" style:--v="{Math.min(100, Math.max(0, trafficPct))}%"></i>
          </div>
        {/if}
        <dl class="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {#each fields as [label, value]}
            <div class="min-w-0 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2">
              <dt class="text-[11px] text-[var(--fg-subtle)]">{label}</dt>
              <dd
                class="tnum mt-0.5 font-medium whitespace-pre-line break-words {label === '到期时间' && exp.level === 'expired'
                  ? 'text-[var(--danger-fg)]'
                  : label === '到期时间' && exp.level === 'soon'
                    ? 'text-[var(--warn-fg)]'
                    : 'text-[var(--fg)]'}"
              >
                {#if label === "系统"}<BrandIcon key={osKey(node.os)} title={node.os} />{" "}{/if}{value || "—"}
              </dd>
            </div>
          {/each}
        </dl>
      </section>
    {/each}
  </div>
</div>

{#snippet stepButton(target: Node | null, label: string, glyph: string)}
  <button
    type="button"
    disabled={!target}
    onclick={() => target && onSelectNode?.(target.id)}
    title={label}
    aria-label={label}
    class="btn w-[30px] px-0"
  >
    {glyph}
  </button>
{/snippet}

<style>
  .node-identity { display: grid; align-items: center; gap: 10px; }
  .detail-stats { display: flex; flex-wrap: wrap; align-items: baseline; gap: 5px 14px; font-size: 12px; }
  .detail-stats > div { white-space: nowrap; }
  @media (min-width: 900px) {
    .node-identity { grid-template-columns: minmax(0, 1fr) auto; }
    .detail-stats { flex-wrap: nowrap; justify-content: flex-end; }
  }
  @media (max-width: 639px) {
    .kpi-mid { flex-direction: column; align-items: flex-start; gap: 2px; }
  }
</style>
