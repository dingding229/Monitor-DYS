<script lang="ts">
  import type uPlot from "uplot"
  import BrandIcon from "@/components/BrandIcon.svelte"
  import CountryFlag from "@/components/CountryFlag.svelte"
  import UPlotChart from "@/components/UPlotChart.svelte"
  import { api, type Node } from "@/lib/api"
  import { withAlpha } from "@/lib/color"
  import {
    FOREVER,
    axisBytes,
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
  import { fadeOverflow } from "@/lib/fadeOverflow"
  import { rangeLabel, rangesFor } from "@/lib/ranges"

  type MetricPoint = {
    ts: number
    minutes?: number
    cpu: number
    cpu_max?: number
    mem_used: number
    swap_used?: number
    disk_used: number
    net_rx: number
    net_tx: number
    net_rx_max?: number
    net_tx_max?: number
    tcp?: number
    udp?: number
    procs?: number
  }

  type PingPoint = {
    task_id: number
    ts: number
    latency: number | null
    loss?: number
  }

  type MetricsResponse = {
    step?: number
    metrics?: MetricPoint[]
    ping?: PingPoint[]
    probes?: Record<string, string>
    loss?: Record<string, number>
  }

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

  let rangeHoursList = $derived(rangesFor(historyDays))
  let selectedHours = $state<number>(6)
  let showPeak = $state<boolean>(false)

  $effect(() => {
    if (!rangeHoursList.includes(selectedHours)) {
      selectedHours = rangeHoursList[0] ?? 24
    }
  })

  let chartContainerEl: HTMLDivElement | undefined = $state()
  let loading = $state(false)
  let fetchError = $state("")
  let metricsResp = $state<MetricsResponse | null>(null)
  let pingResp = $state<MetricsResponse | null>(null)
  let updatedAtStr = $state<string>("")

  function computePoints(): number {
    const rawW = chartContainerEl?.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 720)
    return Math.min(1440, Math.max(60, Math.round(rawW)))
  }

  let reqToken = 0

  function loadHistory(nodeId: number, hours: number) {
    const token = ++reqToken
    loading = true
    fetchError = ""
    const pts = computePoints()
    Promise.all([
      api<MetricsResponse>(`/nodes/${nodeId}/metrics?hours=${hours}&points=${pts}&series=metrics`),
      showPing ? api<MetricsResponse>(`/nodes/${nodeId}/metrics?hours=${hours}&points=${pts}&series=ping`) : null,
    ])
      .then(([mRes, pRes]) => {
        if (token !== reqToken) return
        metricsResp = mRes
        pingResp = pRes
        updatedAtStr = new Date().toLocaleTimeString("zh-CN", { hour12: false })
        loading = false
      })
      .catch((e: unknown) => {
        if (token !== reqToken) return
        fetchError = e instanceof Error ? e.message : "读取历史数据失败"
        loading = false
      })
  }

  $effect(() => {
    loadHistory(node.id, selectedHours)
  })

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

  let hasConnMetrics = $derived.by(() => {
    if (m && (typeof m.tcp === "number" || typeof m.udp === "number" || typeof m.procs === "number")) {
      return true
    }
    const rows = metricsResp?.metrics ?? []
    return rows.some((r) => typeof r.tcp === "number" || typeof r.udp === "number" || typeof r.procs === "number")
  })

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
  let trafficPct = $derived(node.traffic_limit > 0 ? percentNum(periodUsed, node.traffic_limit) : 0)

  let trafficModeLabel = $derived.by(() => {
    switch (node.traffic_mode) {
      case "up":
        return "仅上传"
      case "down":
        return "仅下载"
      case "max":
        return "单向取大"
      default:
        return "双向合计"
    }
  })

  // Per SPEC-v1.2 §6.b: No grey background bands for minutes < step/60; plot partial buckets normally, only break line when minutes === 0 or data is missing
  let processedMetrics = $derived.by(() => {
    const rows = [...(metricsResp?.metrics ?? [])].sort((a, b) => a.ts - b.ts)
    if (rows.length === 0) return null
    const step = metricsResp?.step ?? (rows.length > 1 ? rows[1].ts - rows[0].ts : 60)
    const expectedMinutes = step / 60

    const ts: number[] = []
    const cpu: (number | null)[] = []
    const cpuMax: (number | null)[] = []
    const mem: (number | null)[] = []
    const memCap: (number | null)[] = []
    const disk: (number | null)[] = []
    const diskCap: (number | null)[] = []
    const rx: (number | null)[] = []
    const tx: (number | null)[] = []
    const rxMax: (number | null)[] = []
    const txMax: (number | null)[] = []
    const tcp: (number | null)[] = []
    const udp: (number | null)[] = []
    const procs: (number | null)[] = []

    let hasCpuMax = false
    let hasNetMax = false

    const memTotalVal = m?.mem_total || node.mem_total || 0
    const diskTotalVal = m?.disk_total || node.disk_total || 0

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (i > 0 && step > 0 && r.ts - rows[i - 1].ts > step * 2) {
        const midTs = Math.floor((rows[i - 1].ts + r.ts) / 2)
        ts.push(midTs)
        cpu.push(null)
        cpuMax.push(null)
        mem.push(null)
        memCap.push(memTotalVal > 0 ? memTotalVal : null)
        disk.push(null)
        diskCap.push(diskTotalVal > 0 ? diskTotalVal : null)
        rx.push(null)
        tx.push(null)
        rxMax.push(null)
        txMax.push(null)
        tcp.push(null)
        udp.push(null)
        procs.push(null)
      }

      const isZeroMinutes = typeof r.minutes === "number" && expectedMinutes > 0 && r.minutes <= 0

      ts.push(r.ts)
      cpu.push(isZeroMinutes ? null : r.cpu)
      if (typeof r.cpu_max === "number") {
        hasCpuMax = true
        cpuMax.push(isZeroMinutes ? null : r.cpu_max)
      } else {
        cpuMax.push(null)
      }

      mem.push(isZeroMinutes ? null : r.mem_used)
      memCap.push(memTotalVal > 0 ? memTotalVal : null)

      disk.push(isZeroMinutes ? null : r.disk_used)
      diskCap.push(diskTotalVal > 0 ? diskTotalVal : null)

      rx.push(isZeroMinutes ? null : r.net_rx)
      tx.push(isZeroMinutes ? null : r.net_tx)
      if (typeof r.net_rx_max === "number" || typeof r.net_tx_max === "number") {
        hasNetMax = true
        rxMax.push(isZeroMinutes ? null : (r.net_rx_max ?? r.net_rx))
        txMax.push(isZeroMinutes ? null : (r.net_tx_max ?? r.net_tx))
      } else {
        rxMax.push(null)
        txMax.push(null)
      }

      tcp.push(isZeroMinutes ? null : (r.tcp ?? null))
      udp.push(isZeroMinutes ? null : (r.udp ?? null))
      procs.push(isZeroMinutes ? null : (r.procs ?? null))
    }

    return {
      ts,
      cpu,
      cpuMax,
      hasCpuMax,
      mem,
      memCap,
      memTotalVal,
      disk,
      diskCap,
      diskTotalVal,
      rx,
      tx,
      rxMax,
      txMax,
      hasNetMax,
      tcp,
      udp,
      procs,
    }
  })

  const PROBE_COLORS = ["#10b981", "#2563eb", "#d97706", "#9333ea", "#dc2626", "#0891b2"]

  let processedPing = $derived.by(() => {
    const rawPing = pingResp?.ping ?? []
    if (rawPing.length === 0) return null
    const probesMap = pingResp?.probes ?? {}
    const lossMap = pingResp?.loss ?? {}

    const taskIds: number[] = []
    const seen = new Set<number>()
    for (const p of rawPing) {
      if (!seen.has(p.task_id)) {
        seen.add(p.task_id)
        taskIds.push(p.task_id)
      }
    }

    const timestamps = [...new Set(rawPing.map((p) => p.ts))].sort((a, b) => a - b)
    const tsIndex = new Map<number, number>()
    timestamps.forEach((t, idx) => tsIndex.set(t, idx))

    const latencyMatrix: (number | null)[][] = taskIds.map(() => Array(timestamps.length).fill(null))
    const lossMatrix: (number | null)[][] = taskIds.map(() => Array(timestamps.length).fill(null))
    let hasLossSample = pingResp?.loss != null
    let hasLossPoints = false

    const taskIndex = new Map<number, number>()
    taskIds.forEach((id, idx) => taskIndex.set(id, idx))

    for (const p of rawPing) {
      const tIdx = tsIndex.get(p.ts)
      const sIdx = taskIndex.get(p.task_id)
      if (tIdx !== undefined && sIdx !== undefined) {
        latencyMatrix[sIdx][tIdx] = p.latency
        if (typeof p.loss === "number") {
          hasLossSample = true
          if (p.loss > 0) hasLossPoints = true
          lossMatrix[sIdx][tIdx] = p.loss
        }
      }
    }

    const probeInfos = taskIds.map((id, i) => {
      const name = probesMap[String(id)] ?? `探测 #${id}`
      const totalLoss = lossMap[String(id)]
      const color = i === 0 ? accent : PROBE_COLORS[i % PROBE_COLORS.length]
      return {
        id,
        name,
        totalLoss: typeof totalLoss === "number" ? totalLoss : null,
        color,
      }
    })

    return {
      timestamps,
      probeInfos,
      latencyData: [timestamps, ...latencyMatrix] as uPlot.AlignedData,
      lossData: [timestamps, ...lossMatrix] as uPlot.AlignedData,
      hasLossPoints,
      noLoss: hasLossSample && !hasLossPoints,
    }
  })

  let memPct = $derived(m ? percentNum(m.mem_used, m.mem_total) : 0)
  let diskPct = $derived(m ? percentNum(m.disk_used, m.disk_total) : 0)
</script>

<div class="space-y-3" bind:this={chartContainerEl}>
  <!-- 1. Top Bar: Back Button + Node Switcher (prev/next + select + '全部节点 · N 台') -->
  <div class="flex flex-wrap items-center justify-between gap-2">
    <button
      type="button"
      onclick={onBack}
      class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
    >
      <span>← 返回列表</span>
    </button>

    <div
      data-testid="node-switcher"
      class="flex flex-wrap items-center gap-1.5 text-[12px]"
    >
      <span class="tnum text-neutral-500">{groupLabel} · {switcherList.length} 台</span>
      <button
        type="button"
        disabled={!prevNode}
        onclick={() => prevNode && onSelectNode?.(prevNode.id)}
        title="上一个节点"
        aria-label="上一个节点"
        class="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ‹
      </button>
      <select
        aria-label="切换节点"
        value={node.id}
        onchange={(e) => {
          const nextId = Number((e.currentTarget as HTMLSelectElement).value)
          if (nextId && nextId !== node.id) onSelectNode?.(nextId)
        }}
        class="h-7 max-w-[200px] cursor-pointer truncate rounded-lg border border-neutral-200 bg-white px-2 text-[12px] font-medium text-neutral-800 outline-none focus:border-neutral-400"
      >
        {#each switcherList as item (item.id)}
          <option value={item.id}>{item.name}</option>
        {/each}
      </select>
      <button
        type="button"
        disabled={!nextNode}
        onclick={() => nextNode && onSelectNode?.(nextNode.id)}
        title="下一个节点"
        aria-label="下一个节点"
        class="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ›
      </button>
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
        <div>
          <span class="text-neutral-400">负载 1/5/15m</span>
          <span class="ml-1.5 font-semibold text-neutral-800">
            {m ? m.load.map((v) => v.toFixed(2)).join(" / ") : "—"}
          </span>
        </div>
        {#if hasSwap}
          <div>
            <span class="text-neutral-400">Swap</span>
            <span class="ml-1.5 font-semibold text-neutral-800">
              {m && typeof m.swap_used === "number" && typeof m.swap_total === "number"
                ? pair(m.swap_used, m.swap_total)
                : bytes(node.swap_total ?? 0)}
            </span>
          </div>
        {/if}
        {#if m && typeof m.procs === "number"}
          <div>
            <span class="text-neutral-400">进程</span>
            <span class="ml-1.5 font-semibold text-neutral-800">{m.procs}</span>
          </div>
        {/if}
        {#if m && (typeof m.tcp === "number" || typeof m.udp === "number")}
          <div>
            <span class="text-neutral-400">TCP / UDP</span>
            <span class="ml-1.5 font-semibold text-neutral-800">
              {m.tcp ?? "—"} / {m.udp ?? "—"}
            </span>
          </div>
        {/if}
        <div>
          <span class="text-neutral-400">系统运行</span>
          <span class="ml-1.5 font-semibold text-neutral-800">
            {m ? uptime(m.uptime) : "—"}
          </span>
        </div>
      </div>
    </div>
    {#if isCorrupt}
      <div
        data-testid="status-unavailable"
        class="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-[12px] text-neutral-500"
      >
        不可用
      </div>
    {:else if isWaiting}
      <div
        data-testid="status-waiting"
        class="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-[12px] text-neutral-500"
      >
        等待数据
      </div>
    {/if}
  </div>

  <!-- 3. 4 Stat Cards: CPU (核数、负载) / 内存 (总量) / 磁盘 (总量) / 网络速率 (↑↓) -->
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <!-- CPU Card -->
    <div class="panel rounded-[8px] border border-neutral-200 bg-white p-3">
      <div class="flex items-center justify-between text-[12px] text-neutral-500">
        <span class="font-medium text-neutral-700">CPU</span>
        <span class="tnum">{node.cpu_cores ? `${node.cpu_cores} 核` : "—"}</span>
      </div>
      <div class="tnum mt-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <span class="text-[22px] leading-none font-bold text-neutral-900">
          {m ? `${m.cpu.toFixed(1)}%` : "—"}
        </span>
        <span class="text-[11px] text-neutral-500">
          负载 {m ? m.load[0].toFixed(2) : "—"}
        </span>
      </div>
      <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          class="h-full rounded-full transition-[width] duration-300"
          style="width: {m ? Math.min(100, m.cpu) : 0}%; background-color: var(--accent);"
        ></div>
      </div>
    </div>

    <!-- Memory Card -->
    <div class="panel rounded-[8px] border border-neutral-200 bg-white p-3">
      <div class="flex items-center justify-between text-[12px] text-neutral-500">
        <span class="font-medium text-neutral-700">内存</span>
        <span class="tnum">{bytes(m?.mem_total || node.mem_total)}</span>
      </div>
      <div class="tnum mt-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <span class="text-[22px] leading-none font-bold text-neutral-900">
          {m ? `${memPct.toFixed(1)}%` : "—"}
        </span>
        <span class="text-[11px] text-neutral-500">
          {m ? pair(m.mem_used, m.mem_total) : bytes(node.mem_total)}
        </span>
      </div>
      <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          class="h-full rounded-full transition-[width] duration-300"
          style="width: {m ? Math.min(100, memPct) : 0}%; background-color: var(--accent);"
        ></div>
      </div>
    </div>

    <!-- Disk Card -->
    <div class="panel rounded-[8px] border border-neutral-200 bg-white p-3">
      <div class="flex items-center justify-between text-[12px] text-neutral-500">
        <span class="font-medium text-neutral-700">磁盘</span>
        <span class="tnum">{bytes(m?.disk_total || node.disk_total)}</span>
      </div>
      <div class="tnum mt-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <span class="text-[22px] leading-none font-bold text-neutral-900">
          {m ? `${diskPct.toFixed(1)}%` : "—"}
        </span>
        <span class="text-[11px] text-neutral-500">
          {m ? pair(m.disk_used, m.disk_total) : bytes(node.disk_total)}
        </span>
      </div>
      <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          class="h-full rounded-full transition-[width] duration-300"
          style="width: {m ? Math.min(100, diskPct) : 0}%; background-color: var(--accent);"
        ></div>
      </div>
    </div>

    <!-- Network Speed Card -->
    <div class="panel rounded-[8px] border border-neutral-200 bg-white p-3">
      <div class="flex items-center justify-between text-[12px] text-neutral-500">
        <span class="font-medium text-neutral-700">网络速率</span>
        <span>实时吞吐</span>
      </div>
      <div class="tnum mt-1.5 space-y-1 text-[13px] font-bold">
        <div class="truncate rounded bg-sky-50 px-2 py-0.5 text-sky-700">
          ↓ {m ? speed(m.net_rx) : "0 B/s"}
        </div>
        <div class="truncate rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">
          ↑ {m ? speed(m.net_tx) : "0 B/s"}
        </div>
      </div>
    </div>
  </div>

  <!-- 5. Resource Trends Section: Range buttons + Show Peak checkbox + Refresh button + 4 side-by-side charts -->
  <div class="space-y-2.5">
    <div class="trend-toolbar flex flex-wrap items-center gap-2 text-[12px]">
      <div class="mr-auto">
        <h2 class="text-[14px] font-bold text-neutral-900">资源趋势</h2>
        <p class="tnum text-[11px] text-neutral-400">
          {showPeak ? "含区间峰值" : "历史平均值"}{updatedAtStr ? ` · 更新于 ${updatedAtStr}` : ""}
        </p>
      </div>

      <div class="range-scroll min-w-0 max-w-full overflow-x-auto" use:fadeOverflow role="group" aria-label="时间范围">
        <div class="range-track flex w-max items-center gap-1 py-1">
          {#each rangeHoursList as h (h)}
            {@const active = selectedHours === h}
            <button
              type="button"
              data-testid="range-btn"
              aria-pressed={active}
              onclick={() => (selectedHours = h)}
              class="cursor-pointer rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors {active
                ? 'border-transparent text-white'
                : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'}"
              style={active ? "background-color: var(--accent);" : ""}
            >
              {rangeLabel(h)}
            </button>
          {/each}
        </div>
      </div>

      <div class="trend-actions flex items-center gap-2">
        <label class="desktop-peak inline-flex cursor-pointer items-center gap-1 text-[12px] text-neutral-600">
          <input
            type="checkbox"
            bind:checked={showPeak}
            class="rounded border-neutral-300"
          />
          <span>显示峰值</span>
        </label>

        <button type="button" class="mobile-peak trend-action" aria-label="显示峰值" title="显示峰值"
          aria-pressed={showPeak} onclick={() => (showPeak = !showPeak)}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18h18M3 14l5-6 4 4 5-8 4 6" /></svg>
        </button>

        <button
          type="button"
          aria-label="刷新" title="刷新"
          onclick={() => loadHistory(node.id, selectedHours)}
          class="trend-action cursor-pointer rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[12px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          <span class="refresh-text">刷新</span>
          <svg class="refresh-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10a8 8 0 1 0-1.8 7.2M20 4v6h-6" /></svg>
        </button>
      </div>
    </div>

    {#if fetchError}
      <div class="panel rounded-[8px] border border-red-200 bg-white p-6 text-center text-[12px] text-red-600">
        读取历史数据失败：{fetchError}
      </div>
    {:else if loading && !processedMetrics && !processedPing}
      <div class="panel rounded-[8px] border border-neutral-200 bg-white p-10 text-center text-[12px] text-neutral-400">
        正在加载图表数据…
      </div>
    {:else}
      {#if processedMetrics}
        <!-- 4 charts side-by-side: wide 4 cols, medium 2 cols, mobile 1 col -->
        <div class="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
          <!-- 1. CPU -->
          <UPlotChart
            title="CPU 使用率"
            subtitle={m ? `${m.cpu.toFixed(1)}%` : ""}
            hours={selectedHours}
            data={showPeak && processedMetrics.hasCpuMax
              ? [processedMetrics.ts, processedMetrics.cpu, processedMetrics.cpuMax]
              : [processedMetrics.ts, processedMetrics.cpu]}
            yMin={0}
            yMax={100}
            yFormat={(v) => `${Math.round(v)}%`}
            series={showPeak && processedMetrics.hasCpuMax
              ? [
                  {
                    label: "平均 CPU",
                    stroke: accent,
                    width: 1.5,
                    fill: withAlpha(accent, 0.1),
                    value: (_u, v) => (v == null ? "—" : `${v.toFixed(1)}%`),
                  },
                  {
                    label: "峰值",
                    stroke: "#9ca3af",
                    width: 1,
                    dash: [3, 3],
                    value: (_u, v) => (v == null ? "—" : `${v.toFixed(1)}%`),
                  },
                ]
              : [
                  {
                    label: "平均 CPU",
                    stroke: accent,
                    width: 1.5,
                    fill: withAlpha(accent, 0.1),
                    value: (_u, v) => (v == null ? "—" : `${v.toFixed(1)}%`),
                  },
                ]}
          />

          <!-- 2. Memory (dashed line for total) -->
          <UPlotChart
            title="内存用量"
            subtitle={processedMetrics.memTotalVal ? bytes(processedMetrics.memTotalVal) : ""}
            hours={selectedHours}
            data={processedMetrics.memTotalVal > 0
              ? [processedMetrics.ts, processedMetrics.mem, processedMetrics.memCap]
              : [processedMetrics.ts, processedMetrics.mem]}
            yMin={0}
            yMax={processedMetrics.memTotalVal > 0 ? processedMetrics.memTotalVal * 1.05 : undefined}
            yFormat={(v) => axisBytes(v)}
            series={processedMetrics.memTotalVal > 0
              ? [
                  {
                    label: "使用量",
                    stroke: accent,
                    width: 1.5,
                    fill: withAlpha(accent, 0.1),
                    value: (_u, v) => (v == null ? "—" : bytes(v)),
                  },
                  {
                    label: "当前总容量",
                    stroke: "#94a3b8",
                    width: 1,
                    dash: [4, 3],
                    value: (_u, v) => (v == null ? "—" : bytes(v)),
                  },
                ]
              : [
                  {
                    label: "使用量",
                    stroke: accent,
                    width: 1.5,
                    fill: withAlpha(accent, 0.1),
                    value: (_u, v) => (v == null ? "—" : bytes(v)),
                  },
                ]}
          />

          <!-- 3. Disk (dashed line for total) -->
          <UPlotChart
            title="磁盘用量"
            subtitle={processedMetrics.diskTotalVal ? bytes(processedMetrics.diskTotalVal) : ""}
            hours={selectedHours}
            data={processedMetrics.diskTotalVal > 0
              ? [processedMetrics.ts, processedMetrics.disk, processedMetrics.diskCap]
              : [processedMetrics.ts, processedMetrics.disk]}
            yMin={0}
            yMax={processedMetrics.diskTotalVal > 0 ? processedMetrics.diskTotalVal * 1.05 : undefined}
            yFormat={(v) => axisBytes(v)}
            series={processedMetrics.diskTotalVal > 0
              ? [
                  {
                    label: "使用量",
                    stroke: "#d97706",
                    width: 1.5,
                    fill: withAlpha("#d97706", 0.1),
                    value: (_u, v) => (v == null ? "—" : bytes(v)),
                  },
                  {
                    label: "当前总容量",
                    stroke: "#94a3b8",
                    width: 1,
                    dash: [4, 3],
                    value: (_u, v) => (v == null ? "—" : bytes(v)),
                  },
                ]
              : [
                  {
                    label: "使用量",
                    stroke: "#d97706",
                    width: 1.5,
                    fill: withAlpha("#d97706", 0.1),
                    value: (_u, v) => (v == null ? "—" : bytes(v)),
                  },
                ]}
          />

          <!-- 4. Network Rate -->
          <UPlotChart
            title="网络速率"
            subtitle={m ? `↓ ${speed(m.net_rx)} ↑ ${speed(m.net_tx)}` : ""}
            hours={selectedHours}
            data={showPeak && processedMetrics.hasNetMax
              ? [
                  processedMetrics.ts,
                  processedMetrics.rx,
                  processedMetrics.tx,
                  processedMetrics.rxMax,
                  processedMetrics.txMax,
                ]
              : [processedMetrics.ts, processedMetrics.rx, processedMetrics.tx]}
            yMin={0}
            yFormat={(v) => `${axisBytes(v)}/s`}
            series={showPeak && processedMetrics.hasNetMax
              ? [
                  {
                    label: "下载",
                    stroke: "#0284c7",
                    width: 1.5,
                    fill: withAlpha("#0284c7", 0.08),
                    value: (_u, v) => (v == null ? "—" : speed(v)),
                  },
                  {
                    label: "上传",
                    stroke: accent,
                    width: 1.5,
                    value: (_u, v) => (v == null ? "—" : speed(v)),
                  },
                  {
                    label: "下载峰值",
                    stroke: "#0284c7",
                    width: 1,
                    dash: [2, 2],
                    value: (_u, v) => (v == null ? "—" : speed(v)),
                  },
                  {
                    label: "上传峰值",
                    stroke: accent,
                    width: 1,
                    dash: [2, 2],
                    value: (_u, v) => (v == null ? "—" : speed(v)),
                  },
                ]
              : [
                  {
                    label: "下载",
                    stroke: "#0284c7",
                    width: 1.5,
                    fill: withAlpha("#0284c7", 0.08),
                    value: (_u, v) => (v == null ? "—" : speed(v)),
                  },
                  {
                    label: "上传",
                    stroke: accent,
                    width: 1.5,
                    value: (_u, v) => (v == null ? "—" : speed(v)),
                  },
                ]}
          />
        </div>

        {#if hasConnMetrics}
          <UPlotChart
            title="TCP / UDP / 进程数"
            height={180}
            hours={selectedHours}
            data={[
              processedMetrics.ts,
              processedMetrics.tcp,
              processedMetrics.udp,
              processedMetrics.procs,
            ]}
            yMin={0}
            series={[
              {
                label: "TCP",
                stroke: accent,
                width: 1.5,
                value: (_u, v) => (v == null ? "—" : String(Math.round(v))),
              },
              {
                label: "UDP",
                stroke: "#0284c7",
                width: 1.5,
                value: (_u, v) => (v == null ? "—" : String(Math.round(v))),
              },
              {
                label: "进程",
                stroke: "#d97706",
                width: 1.25,
                dash: [4, 2],
                value: (_u, v) => (v == null ? "—" : String(Math.round(v))),
              },
            ]}
          />
        {/if}
      {/if}

      <!-- Ping Latency & Loss below (Per SPEC-v1.2 §6.e: remove subtitle on Ping Latency, remove '丢包' from Ping Loss legend labels) -->
      {#if showPing && processedPing}
        <div class="grid grid-cols-1 items-start gap-3 {processedPing.hasLossPoints ? 'lg:grid-cols-2' : ''}">
          <UPlotChart
            title="Ping 延迟"
            noLoss={processedPing.noLoss}
            height={180}
            hours={selectedHours}
            data={processedPing.latencyData}
            yMin={0}
            yFormat={(v) => `${Math.round(v)} ms`}
            series={processedPing.probeInfos.map((p) => ({
              label: p.totalLoss !== null && p.totalLoss > 0 ? `${p.name} (丢 ${p.totalLoss.toFixed(1)}%)` : p.name,
              stroke: p.color,
              width: 1.5,
              value: (_u, v) => (v == null ? "超时" : `${Math.round(v)} ms`),
            }))}
          />

          {#if processedPing.hasLossPoints}
            <UPlotChart
              title="Ping 丢包率"
              height={180}
              hours={selectedHours}
              data={processedPing.lossData}
              yMin={0}
              yMax={100}
              yFormat={(v) => `${Math.round(v)}%`}
              series={processedPing.probeInfos.map((p) => ({
                label: p.name,
                stroke: p.color,
                width: 1.25,
                value: (_u, v) => (v == null ? "0%" : `${v.toFixed(1)}%`),
              }))}
            />
          {/if}
        </div>
      {/if}
    {/if}
  </div>

  <!-- 6. Bottom Two-Column Panels: 「硬件与系统」 & 「流量与费用」 -->
  <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
    <!-- Left Panel: 硬件与系统 -->
    <section class="panel rounded-[8px] border border-neutral-200 bg-white p-3.5">
      <h3 class="text-[13px] font-bold text-neutral-900">硬件与系统</h3>
      <p class="text-[11px] text-neutral-400">主控提供的节点资料</p>

      <div class="mt-3 space-y-2 text-[12px]">
        <div class="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
          <span class="text-neutral-500">CPU 型号</span>
          <span class="font-medium text-neutral-800">{cpuName(node.cpu_name) || "—"}</span>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-lg bg-neutral-50 px-3 py-2">
            <div class="text-[11px] text-neutral-400">CPU 核心</div>
            <div class="tnum mt-0.5 font-semibold text-neutral-800">{node.cpu_cores ? `${node.cpu_cores} 核` : "—"}</div>
          </div>
          <div class="rounded-lg bg-neutral-50 px-3 py-2">
            <div class="text-[11px] text-neutral-400">架构 / 虚拟化</div>
            <div class="mt-0.5 font-semibold text-neutral-800">
              {[node.arch, node.virt && node.virt !== "none" ? node.virt : ""].filter(Boolean).join(" / ") || "—"}
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
          <span class="text-neutral-500">系统</span>
          <span class="inline-flex items-center gap-1.5 font-medium text-neutral-800">
            <BrandIcon key={osKey(node.os)} kind="os" size={14} title={node.os || "未知系统"} />
            <span>{node.os || "—"}</span>
          </span>
        </div>

        <div class="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
          <span class="text-neutral-500">内核</span>
          <span class="tnum font-medium text-neutral-800">{node.kernel || "—"}</span>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-lg bg-neutral-50 px-3 py-2">
            <div class="text-[11px] text-neutral-400">物理内存 / Swap</div>
            <div class="tnum mt-0.5 font-semibold text-neutral-800">
              {bytes(node.mem_total)}{hasSwap ? ` / ${bytes(node.swap_total ?? m?.swap_total ?? 0)}` : ""}
            </div>
          </div>
          <div class="rounded-lg bg-neutral-50 px-3 py-2">
            <div class="text-[11px] text-neutral-400">磁盘总容量</div>
            <div class="tnum mt-0.5 font-semibold text-neutral-800">{bytes(node.disk_total)}</div>
          </div>
        </div>

        <div class="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
          <span class="text-neutral-500">Agent 版本</span>
          <span class="tnum font-medium text-neutral-800">{node.agent_version || "—"}</span>
        </div>

        <!-- Admin-only fields shown ONLY when present -->
        {#if node.ip || node.hostname || node.remark || node.public_remark}
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {#if node.ip}
              <div class="rounded-lg bg-neutral-50 px-3 py-2">
                <div class="text-[11px] text-neutral-400">IP 地址</div>
                <div class="tnum mt-0.5 font-semibold text-neutral-800">{node.ip}</div>
              </div>
            {/if}
            {#if node.hostname}
              <div class="rounded-lg bg-neutral-50 px-3 py-2">
                <div class="text-[11px] text-neutral-400">主机名</div>
                <div class="mt-0.5 font-semibold text-neutral-800">{node.hostname}</div>
              </div>
            {/if}
          </div>
          {#if node.remark || node.public_remark}
            <div class="rounded-lg bg-neutral-50 px-3 py-2">
              <div class="text-[11px] text-neutral-400">备注</div>
              <div class="mt-0.5 whitespace-pre-line text-neutral-700">{node.remark || node.public_remark}</div>
            </div>
          {/if}
        {/if}
      </div>
    </section>

    <!-- Right Panel: 流量与费用 -->
    <section class="panel rounded-[8px] border border-neutral-200 bg-white p-3.5">
      <h3 class="text-[13px] font-bold text-neutral-900">流量与费用</h3>
      <p class="text-[11px] text-neutral-400">按主控计费规则与当前节点配置展示</p>

      <div class="mt-3 space-y-2 text-[12px]">
        <!-- 当期计费流量进度 -->
        <div class="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
          <div class="flex items-center justify-between">
            <span class="text-neutral-600">当期计费流量</span>
            <span class="tnum font-bold text-neutral-900">
              {node.traffic_limit > 0
                ? `${pair(periodUsed, node.traffic_limit)} (${trafficPct.toFixed(1)}%)`
                : `${bytes(periodUsed)} / ${FOREVER}`}
            </span>
          </div>
          <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              class="h-full rounded-full transition-[width] duration-300"
              style="width: {node.traffic_limit > 0 ? Math.min(100, trafficPct) : 0}%; background-color: var(--accent);"
            ></div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-lg bg-neutral-50 px-3 py-2">
            <div class="text-[11px] text-neutral-400">当期上传 / 下载</div>
            <div class="tnum mt-0.5 font-semibold text-neutral-800">
              {bytes(node.month_tx ?? 0)} / {bytes(node.month_rx ?? 0)}
            </div>
          </div>
          <div class="rounded-lg bg-neutral-50 px-3 py-2">
            <div class="text-[11px] text-neutral-400">计费方向 / 重置日</div>
            <div class="tnum mt-0.5 font-semibold text-neutral-800">
              {trafficModeLabel}{node.traffic_reset_day ? ` · 每月 ${node.traffic_reset_day} 日` : ""}
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-lg bg-neutral-50 px-3 py-2">
            <div class="text-[11px] text-neutral-400">累计上传 / 下载</div>
            <div class="tnum mt-0.5 font-semibold text-neutral-800">
              {bytes(node.total_tx ?? 0)} / {bytes(node.total_rx ?? 0)}
            </div>
          </div>
          {#if showBilling}
            <div class="rounded-lg bg-neutral-50 px-3 py-2">
              <div class="text-[11px] text-neutral-400">录入标价</div>
              <div class="tnum mt-0.5 font-semibold text-neutral-800">
                {#if typeof node.price === "number" && node.price > 0}
                  {priceFull(node.price, node.currency || "CNY", node.billing_cycle)}
                {:else}
                  免费 / 未设
                {/if}
              </div>
            </div>
          {/if}
        </div>

        <div>
          <div class="rounded-lg bg-neutral-50 px-3 py-2">
            <div class="text-[11px] text-neutral-400">到期时间</div>
            <div
              class="tnum mt-0.5 font-semibold {exp.level === 'expired'
                ? 'text-red-600'
                : exp.level === 'soon'
                  ? 'text-amber-600'
                  : 'text-neutral-800'}"
            >
              {node.expires_at ? `${node.expires_at} (${exp.text})` : exp.text || FOREVER}
            </div>
          </div>
        </div>

      </div>
    </section>
  </div>
</div>

<style>
  .node-identity { display: grid; align-items: center; gap: 10px; }
  .detail-stats { display: flex; flex-wrap: wrap; align-items: baseline; gap: 5px 14px; font-size: 12px; }
  .detail-stats > div { white-space: nowrap; }
  @media (min-width: 900px) {
    .node-identity { grid-template-columns: minmax(0, 1fr) auto; }
    .detail-stats { flex-wrap: nowrap; justify-content: flex-end; }
  }
  .mobile-peak, .refresh-icon { display: none; }

  @media (width < 640px) {
    .trend-toolbar { display: grid; grid-template-columns: minmax(0, 1fr) auto; }
    .trend-actions { grid-area: 1 / 2; }
    .range-scroll { grid-area: 2 / 1 / auto / -1; }
    .range-track button { min-width: 64px; min-height: 40px; padding-inline: 13px; white-space: nowrap; }
    .desktop-peak, .refresh-text { display: none; }
    .refresh-icon { display: block; }
    .trend-action {
      display: inline-grid; place-items: center; width: 44px; height: 44px; padding: 0;
      border: 1px solid var(--border); background-color: white; color: #475954; cursor: pointer;
    }
    .mobile-peak[aria-pressed="true"] { color: white; background-color: color-mix(in srgb, var(--accent) 58%, #082b21); }
  }
</style>
