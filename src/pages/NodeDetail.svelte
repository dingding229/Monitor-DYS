<script lang="ts">
  import DetailHistory from "@/components/DetailHistory.svelte"
  import BrandIcon from "@/components/BrandIcon.svelte"
  import CountryFlag from "@/components/CountryFlag.svelte"
  import type { Node } from "@/lib/api"
  import {
    monthUsage, FOREVER,
    bytes,
    cpuName,
    expiry,
    priceFull,
    offlineFor,
    pair,
    percentNum,
    regionName,
    speed,
    uptime,
  } from "@/lib/format"
  import { osKey } from "@/lib/icons"

  let {
    node, showPing,
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
  let nextNode = $derived(
    currentIndex >= 0 && currentIndex < switcherList.length - 1 ? switcherList[currentIndex + 1] : null,
  )

  let m = $derived(node.metrics)
  let isCorrupt = $derived(Boolean(node._corrupt))
  let isWaiting = $derived(node.online && !m && !isCorrupt)
  let offDur = $derived(!node.online ? offlineFor(node) : null)
  let exp = $derived(expiry(node, Date.now(), expiryWarningDays))

  let lastSeenSec = $derived.by(() => {
    if ("last_seen_ago" in node && node.last_seen_ago !== undefined) {
      return node.last_seen_ago
    }
    if (node.last_seen && node.last_seen > 0) {
      return Math.max(0, Math.floor(Date.now() / 1000 - node.last_seen))
    }
    return null
  })

  let hasSwap = $derived(
    (typeof node.swap_total === "number" && node.swap_total > 0) ||
      (typeof m?.swap_total === "number" && m.swap_total > 0),
  )

  let info = $derived([
    ['负载 1/5/15m', m?.load.map(v=>v.toFixed(2)).join(' / ') ?? '—'],
    ['Swap',hasSwap ? m?.swap_used != null && m.swap_total != null ? pair(m.swap_used,m.swap_total) : bytes(node.swap_total??0) : null],
    ['进程',m?.procs], ['TCP / UDP',m?.tcp != null || m?.udp != null ? `${m?.tcp??'—'} / ${m?.udp??'—'}` : null],
    ['系统运行',m ? uptime(m.uptime) : '—'],
  ])
  let periodUsed = $derived(monthUsage(node))
  let trafficPct = $derived(node.traffic_limit > 0 ? percentNum(periodUsed, node.traffic_limit) : 0)

  const modes: Record<string,string> = { up: "仅上传", down: "仅下载", max: "单向取大" }
  let stats = $derived([
    {label:"CPU", cap: node.cpu_cores ? `${node.cpu_cores} 核` : "—", pct:m?.cpu, note:`负载 ${m?.load[0]?.toFixed(2) ?? "—"}`},
    {label:"内存",cap:bytes(m?.mem_total || node.mem_total),pct:m && percentNum(m.mem_used,m.mem_total),note:m ? pair(m.mem_used,m.mem_total) : bytes(node.mem_total)},
    {label:"硬盘",cap:bytes(m?.disk_total || node.disk_total),pct:m && percentNum(m.disk_used,m.disk_total),note:m ? pair(m.disk_used,m.disk_total) : bytes(node.disk_total)},
  ])
  let hardware = $derived([["CPU 型号",cpuName(node.cpu_name)], ["CPU 核心",node.cpu_cores && `${node.cpu_cores} 核`], ["架构 / 虚拟化",[node.arch,node.virt === "none" ? "" : node.virt].filter(Boolean).join(" / ")], ["系统",node.os], ["内核",node.kernel], ["物理内存 / Swap",bytes(node.mem_total)+(hasSwap ? ` / ${bytes(node.swap_total || m?.swap_total || 0)}` : "")], ["磁盘总量",bytes(node.disk_total)], ["Agent 版本",node.agent_version], ...[["IP 地址",node.ip],["主机名",node.hostname],["备注",node.remark || node.public_remark]].filter(([,v])=>v)])
  let billing = $derived([["当期上传 / 下载",`${bytes(node.month_tx)} / ${bytes(node.month_rx)}`], ["计费方向 / 重置日",(modes[node.traffic_mode] ?? "双向合计") + (node.traffic_reset_day ? ` · 每月 ${node.traffic_reset_day} 日` : "")], ["累计上传 / 下载",`${bytes(node.total_tx)} / ${bytes(node.total_rx)}`], ...(showBilling ? [["录入标价",node.price > 0 ? priceFull(node.price,node.currency || "CNY",node.billing_cycle) : "免费 / 未设"]] : []), ["到期时间", node.expires_at ? `${node.expires_at} (${exp.text})` : exp.text || FOREVER]])
  function keyboard(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable=true]'))) return
    const target = event.key === "ArrowLeft" ? prevNode : event.key === "ArrowRight" ? nextNode : null
    if (target) { event.preventDefault(); onSelectNode?.(target.id) }
  }
</script>
<svelte:window onkeydown={keyboard} />
<div class="space-y-3">
  <!-- 1. Top Bar: Back Button + Node Switcher (prev/next + select + '全部节点 · N 台') -->
  <div class="flex flex-wrap items-center justify-between gap-2">
    <button
      type="button"
      onclick={onBack}
      class="nav-control back"
    >
      <span>← 返回列表</span>
    </button>

    <div
      data-testid="node-switcher"
      class="flex flex-wrap items-center gap-1.5 text-[12px]"
    >
      <span class="tnum text-neutral-500">{groupLabel} · {switcherList.length} 台</span>
      {@render stepButton(prevNode,"上一个节点","‹")}
      <select
        aria-label="切换节点"
        value={node.id}
        onchange={(e) => {
          const nextId = Number((e.currentTarget as HTMLSelectElement).value)
          if (nextId && nextId !== node.id) onSelectNode?.(nextId)
        }}
        class="nav-control select"
      >
        {#each switcherList as item (item.id)}
          <option value={item.id}>{item.name}</option>
        {/each}
      </select>
      {@render stepButton(nextNode,"下一个节点","›")}
    </div>
  </div>

  <!-- 2. Header: Flag + Name + Online Status Capsule + Subtext (地区 · 分组 · 最近上报 N 秒前) -->
  <div class="panel rounded-[8px] border border-neutral-200 bg-white p-3.5">
    <div class="node-identity">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2.5">
          <CountryFlag code={node.country} />
          <h1 class="text-lg font-bold text-neutral-900">{node.name}</h1>
          <span
            class="tnum inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium {node.online
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-neutral-100 text-neutral-600'}"
          >
            <span
              class="h-2 w-2 rounded-full"
              style="background-color: {node.online ? 'var(--online)' : 'var(--offline)'};"
            ></span>
            {#if node.online}
              在线
            {:else}
              离线{offDur ? ` · ${offDur}` : ""}
            {/if}
          </span>
        </div>

        <p class="tnum mt-1 text-[12px] text-neutral-500">
          {[
            regionName(node.country) || "未知地区",
            node.group || "未分组",
            lastSeenSec === null ? "从未上报" : `最近上报 ${lastSeenSec} 秒前`,
          ].join(" · ")}
        </p>
      </div>
      <div data-testid="detail-stats" class="detail-stats tnum">
        {#each info as [label,value]}{#if value != null}
          <div><span class="text-neutral-400">{label}</span><span class="ml-1.5 font-semibold text-neutral-800">{value}</span></div>
        {/if}{/each}
      </div>
    </div>
    {#if isCorrupt || isWaiting}
      <div data-testid={isCorrupt?'status-unavailable':'status-waiting'} class="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-[12px] text-neutral-500">{isCorrupt?'不可用':'等待数据'}</div>
    {/if}
  </div>

  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {#each stats as stat}
      <section class="panel p-3">
        <div class="flex justify-between text-[12px] text-neutral-600"><span>{stat.label}</span>{stat.cap}</div>
        <div class="my-2 flex flex-wrap items-baseline justify-between gap-1"><strong class="text-[22px]">{stat.pct == null ? "—" : `${stat.pct.toFixed(1)}%`}</strong><small>{stat.note}</small></div>
        {@render bar(stat.pct ?? 0)}
      </section>
    {/each}
    <section class="panel p-3"><div class="text-[12px]">网络速率</div><p class="mt-2 text-sky-700">↓ {speed(m?.net_rx ?? 0)}</p><p class="text-emerald-700">↑ {speed(m?.net_tx ?? 0)}</p></section>
  </div>
  <DetailHistory {node} {accent} {historyDays} {showPing} />
  <div class="grid gap-3 lg:grid-cols-2">
    {#each [["硬件与系统", hardware], ["流量与费用", billing]] as const as [title, fields]}
      <section class="panel p-3.5"><h3 class="font-bold">{title}</h3>
        {#if title === '流量与费用'}<div class="my-2 bg-emerald-50 p-2">当期计费流量　{node.traffic_limit > 0 ? `${pair(periodUsed,node.traffic_limit)} (${trafficPct.toFixed(1)}%)` : `${bytes(periodUsed)} / ${FOREVER}`}{@render bar(trafficPct)}</div>{/if}
        <dl class="mt-2 grid grid-cols-2 gap-2">{#each fields as [label,value]}
          <div class="min-w-0 rounded-md bg-neutral-50 px-3 py-2"><dt class="text-[11px] text-neutral-500">{label}</dt>
            <dd class:text-red-600={label === "到期时间" && exp.level === "expired"} class:text-amber-600={label === "到期时间" && exp.level === "soon"} class="tnum mt-1 font-medium whitespace-pre-line break-words">{#if label === '系统'}<BrandIcon key={osKey(node.os)} title={node.os} /> {/if}{value || "—"}</dd></div>
        {/each}</dl>
      </section>
    {/each}
  </div>
</div>
{#snippet stepButton(target:Node|null,label:string,glyph:string)}
  <button
        type="button"
        disabled={!target}
        onclick={() => target && onSelectNode?.(target.id)}
        title={label}
        aria-label={label}
        class="nav-control step"
      >
        {glyph}
      </button>
{/snippet}
{#snippet bar(pct: number)}<div class="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100"><div class="h-full" style:width="{Math.min(100, Math.max(0,pct))}%" style:background="var(--accent)"></div></div>{/snippet}
<style>
  .nav-control { border:1px solid var(--border); border-radius:6px; background:white; color:#404040; cursor:pointer; font-family:inherit; font-size:12px; font-weight:500 }
  .nav-control:hover {background:#fafafa}.nav-control:disabled {opacity:.4;cursor:not-allowed}
  .back {padding:.375rem .75rem}.step,.select {height:1.75rem}.step {width:1.75rem}.select {max-width:200px;padding-inline:.5rem;text-overflow:ellipsis}

  .node-identity { display: grid; align-items: center; gap: 10px; }
  .detail-stats { display: flex; flex-wrap: wrap; align-items: baseline; gap: 5px 14px; font-size: 12px; }
  .detail-stats > div { white-space: nowrap; }
  @media (min-width: 900px) {
    .node-identity { grid-template-columns: minmax(0, 1fr) auto; }
    .detail-stats { flex-wrap: nowrap; justify-content: flex-end; }
  }
</style>
