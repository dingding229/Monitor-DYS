<script lang="ts">
  import type uPlot from "uplot"
  import CountryFlag from "@/components/CountryFlag.svelte"
  import UPlotChart from "@/components/UPlotChart.svelte"
  import { api, type Node } from "@/lib/api"
  import {
    axisBytes,
    bytes,
    cpuName,
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
    node,
    historyDays = 7,
    showBilling = true,
    accent = "#2563eb",
    onBack,
  }: {
    node: Node
    historyDays?: number
    showBilling?: boolean
    accent?: string
    onBack: () => void
  } = $props()

  let rangeHoursList = $derived(rangesFor(historyDays))
  let selectedHours = $state<number>(6)

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
      api<MetricsResponse>(`/nodes/${nodeId}/metrics?hours=${hours}&points=${pts}&series=ping`),
    ])
      .then(([mRes, pRes]) => {
        if (token !== reqToken) return
        metricsResp = mRes
        pingResp = pRes
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
  let exp = $derived(expiry(node))

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

  // Process metrics series with gap insertion when ts jumps > 2 * step or partial offline when minutes < step / 60
  let processedMetrics = $derived.by(() => {
    const rows = [...(metricsResp?.metrics ?? [])].sort((a, b) => a.ts - b.ts)
    if (rows.length === 0) return null
    const step = metricsResp?.step ?? (rows.length > 1 ? rows[1].ts - rows[0].ts : 60)
    const expectedMinutes = step / 60

    const ts: number[] = []
    const cpu: (number | null)[] = []
    const cpuMax: (number | null)[] = []
    const mem: (number | null)[] = []
    const swap: (number | null)[] = []
    const rx: (number | null)[] = []
    const tx: (number | null)[] = []
    const rxMax: (number | null)[] = []
    const txMax: (number | null)[] = []
    const tcp: (number | null)[] = []
    const udp: (number | null)[] = []
    const procs: (number | null)[] = []
    const partialBuckets: { from: number; to: number }[] = []

    let hasCpuMax = false
    let hasNetMax = false
    let hasSwapSeries = false

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (i > 0 && step > 0 && r.ts - rows[i - 1].ts > step * 2) {
        const midTs = Math.floor((rows[i - 1].ts + r.ts) / 2)
        ts.push(midTs)
        cpu.push(null)
        cpuMax.push(null)
        mem.push(null)
        swap.push(null)
        rx.push(null)
        tx.push(null)
        rxMax.push(null)
        txMax.push(null)
        tcp.push(null)
        udp.push(null)
        procs.push(null)
      }

      // Per SPEC §5.9: minutes < step/60 means partial offline during bucket
      const isZeroMinutes = typeof r.minutes === "number" && expectedMinutes > 0 && r.minutes <= 0
      if (typeof r.minutes === "number" && expectedMinutes > 0 && r.minutes < expectedMinutes) {
        partialBuckets.push({ from: r.ts, to: r.ts + step })
      }

      ts.push(r.ts)
      cpu.push(isZeroMinutes ? null : r.cpu)
      if (typeof r.cpu_max === "number") {
        hasCpuMax = true
        cpuMax.push(isZeroMinutes ? null : r.cpu_max)
      } else {
        cpuMax.push(null)
      }

      mem.push(isZeroMinutes ? null : r.mem_used)
      if (typeof r.swap_used === "number") {
        hasSwapSeries = true
        swap.push(isZeroMinutes ? null : r.swap_used)
      } else {
        swap.push(null)
      }

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
      swap,
      hasSwapSeries,
      rx,
      tx,
      rxMax,
      txMax,
      hasNetMax,
      tcp,
      udp,
      procs,
      partialBuckets,
    }
  })

  // Process Ping series ordered by first appearance of task_id (SPEC §5.10)
  const PROBE_COLORS = ["#2563eb", "#16a34a", "#d97706", "#9333ea", "#dc2626", "#0891b2"]

  let processedPing = $derived.by(() => {
    const rawPing = pingResp?.ping ?? []
    if (rawPing.length === 0) return null
    const probesMap = pingResp?.probes ?? {}
    const lossMap = pingResp?.loss ?? {}

    // Order by first appearance of task_id
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
    let hasLossPoints = false

    const taskIndex = new Map<number, number>()
    taskIds.forEach((id, idx) => taskIndex.set(id, idx))

    for (const p of rawPing) {
      const tIdx = tsIndex.get(p.ts)
      const sIdx = taskIndex.get(p.task_id)
      if (tIdx !== undefined && sIdx !== undefined) {
        latencyMatrix[sIdx][tIdx] = p.latency
        if (typeof p.loss === "number") {
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
    }
  })

  let billingSummary = $derived.by(() => {
    if (!showBilling) return ""
    const parts: string[] = []
    if (typeof node.price === "number" && node.price > 0) {
      const p = money(node.price, node.currency || "CNY")
      const m = cycleMonths(node.billing_cycle)
      const label = cycleLabel(node.billing_cycle)
      if (Number.isNaN(m)) {
        parts.push(label ? `${p} / ${label}` : p)
      } else if (m === 0) {
        parts.push(`${p} · 一次性`)
      } else {
        const monthly = m > 1 ? ` (约 ${money(node.price / m, node.currency || "CNY")}/月)` : ""
        parts.push(`${p} / ${label}${monthly}`)
      }
    }
    if (exp.level !== "none" && exp.text) {
      parts.push(exp.text)
    }
    return parts.join(" · ")
  })
</script>

<div class="space-y-4" bind:this={chartContainerEl}>
  <!-- Back button & Header -->
  <div class="flex flex-wrap items-center justify-between gap-3">
    <button
      type="button"
      onclick={onBack}
      class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
    >
      <span>← 返回列表</span>
    </button>

    <!-- Time Range Buttons -->
    <div class="flex flex-wrap items-center gap-1" role="group" aria-label="时间范围">
      {#each rangeHoursList as h (h)}
        {@const active = selectedHours === h}
        <button
          type="button"
          data-testid="range-btn"
          aria-pressed={active}
          onclick={() => (selectedHours = h)}
          class="cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors {active
            ? 'border-transparent text-white'
            : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'}"
          style={active ? "background-color: var(--accent);" : ""}
        >
          {rangeLabel(h)}
        </button>
      {/each}
    </div>
  </div>

  <!-- Node Info Card -->
  <div class="rounded-[12px] border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <CountryFlag code={node.country} />
        <h1 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{node.name}</h1>
        {#if node.group}
          <span class="rounded border border-neutral-200 px-2 py-0.5 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            {node.group}
          </span>
        {/if}
      </div>

      <div class="flex items-center gap-2">
        <span class="tnum inline-flex items-center gap-1.5 text-xs font-medium">
          <span
            class="h-2.5 w-2.5 rounded-full"
            style="background-color: {node.online ? 'var(--online)' : 'var(--offline)'};"
          ></span>
          {#if node.online}
            <span class="text-neutral-700 dark:text-neutral-300">
              在线 {m ? `· ${uptime(m.uptime)}` : ""}
            </span>
          {:else}
            <span class="text-neutral-500 dark:text-neutral-400">
              离线{offDur ? ` · ${offDur}` : ""}
            </span>
          {/if}
        </span>
      </div>
    </div>

    {#if isCorrupt}
      <div
        data-testid="status-unavailable"
        class="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-400"
      >
        不可用
      </div>
    {:else if isWaiting}
      <div
        data-testid="status-waiting"
        class="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-400"
      >
        等待数据
      </div>
    {/if}

    <dl class="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-neutral-100 pt-4 text-xs sm:grid-cols-2 lg:grid-cols-3 dark:border-neutral-800">
      <div>
        <dt class="text-neutral-400 dark:text-neutral-500">系统 / 内核</dt>
        <dd class="mt-0.5 font-medium text-neutral-800 dark:text-neutral-200">
          {[osName(node.os), node.kernel].filter(Boolean).join(" · ") || "—"}
        </dd>
      </div>
      <div>
        <dt class="text-neutral-400 dark:text-neutral-500">CPU / 架构</dt>
        <dd class="mt-0.5 font-medium text-neutral-800 dark:text-neutral-200">
          {[
            node.cpu_name ? cpuName(node.cpu_name) : "",
            node.cpu_cores ? `${node.cpu_cores} 核` : "",
            node.arch,
            node.virt && node.virt !== "none" ? node.virt : "",
          ]
            .filter(Boolean)
            .join(" · ") || "—"}
        </dd>
      </div>
      <div>
        <dt class="text-neutral-400 dark:text-neutral-500">内存 / 硬盘{hasSwap ? " / Swap" : ""}</dt>
        <dd class="tnum mt-0.5 font-medium text-neutral-800 dark:text-neutral-200">
          {m ? pair(m.mem_used, m.mem_total) : bytes(node.mem_total)} ·
          {m ? pair(m.disk_used, m.disk_total) : bytes(node.disk_total)}
          {#if hasSwap}
            · Swap {m && typeof m.swap_used === "number" && typeof m.swap_total === "number"
              ? pair(m.swap_used, m.swap_total)
              : bytes(node.swap_total ?? 0)}
          {/if}
        </dd>
      </div>
      <div>
        <dt class="text-neutral-400 dark:text-neutral-500">累计流量 (总计 / 本月)</dt>
        <dd class="tnum mt-0.5 font-medium text-neutral-800 dark:text-neutral-200">
          总 ↓ {bytes(node.total_rx ?? 0)} ↑ {bytes(node.total_tx ?? 0)} · 月 ↓ {bytes(node.month_rx ?? 0)} ↑ {bytes(node.month_tx ?? 0)}
        </dd>
      </div>
      {#if m && (typeof m.tcp === "number" || typeof m.udp === "number" || typeof m.procs === "number")}
        <div>
          <dt class="text-neutral-400 dark:text-neutral-500">连接 / 进程</dt>
          <dd class="tnum mt-0.5 font-medium text-neutral-800 dark:text-neutral-200">
            {[
              typeof m.tcp === "number" ? `TCP ${m.tcp}` : "",
              typeof m.udp === "number" ? `UDP ${m.udp}` : "",
              typeof m.procs === "number" ? `进程 ${m.procs}` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </dd>
        </div>
      {/if}
      {#if showBilling && billingSummary}
        <div>
          <dt class="text-neutral-400 dark:text-neutral-500">计费与到期</dt>
          <dd class="tnum mt-0.5 font-medium text-neutral-800 dark:text-neutral-200">
            {billingSummary}
          </dd>
        </div>
      {/if}
    </dl>

    {#if node.public_remark}
      <p class="mt-3 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600 whitespace-pre-line dark:bg-neutral-800/60 dark:text-neutral-300">
        {node.public_remark}
      </p>
    {/if}
  </div>

  <!-- Charts -->
  {#if fetchError}
    <div class="rounded-[12px] border border-red-200 bg-white p-6 text-center text-xs text-red-600 dark:border-red-900/50 dark:bg-neutral-900 dark:text-red-400">
      读取历史数据失败：{fetchError}
    </div>
  {:else if loading && !processedMetrics && !processedPing}
    <div class="rounded-[12px] border border-neutral-200 bg-white p-12 text-center text-xs text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
      正在加载图表数据…
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {#if processedMetrics}
        <!-- 1. CPU Chart -->
        <UPlotChart
          title="CPU 使用率"
          subtitle={m ? `当前 ${m.cpu.toFixed(1)}%` : ""}
          partialBuckets={processedMetrics.partialBuckets}
          data={processedMetrics.hasCpuMax
            ? [processedMetrics.ts, processedMetrics.cpu, processedMetrics.cpuMax]
            : [processedMetrics.ts, processedMetrics.cpu]}
          yMin={0}
          yMax={100}
          yFormat={(v) => `${Math.round(v)}%`}
          series={processedMetrics.hasCpuMax
            ? [
                {
                  label: "平均",
                  stroke: accent,
                  width: 1.5,
                  fill: `${accent}1a`,
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
                  label: "CPU",
                  stroke: accent,
                  width: 1.5,
                  fill: `${accent}1a`,
                  value: (_u, v) => (v == null ? "—" : `${v.toFixed(1)}%`),
                },
              ]}
        />

        <!-- 2. Memory (& Swap if present) Chart -->
        <UPlotChart
          title="内存使用"
          subtitle={node.mem_total ? `总计 ${bytes(node.mem_total)}` : ""}
          partialBuckets={processedMetrics.partialBuckets}
          data={hasSwap && processedMetrics.hasSwapSeries
            ? [processedMetrics.ts, processedMetrics.mem, processedMetrics.swap]
            : [processedMetrics.ts, processedMetrics.mem]}
          yMin={0}
          yMax={node.mem_total > 0 ? node.mem_total : undefined}
          yFormat={(v) => axisBytes(v)}
          series={hasSwap && processedMetrics.hasSwapSeries
            ? [
                {
                  label: "内存",
                  stroke: accent,
                  width: 1.5,
                  fill: `${accent}1a`,
                  value: (_u, v) => (v == null ? "—" : bytes(v)),
                },
                {
                  label: "Swap",
                  stroke: "#9ca3af",
                  width: 1.25,
                  dash: [4, 2],
                  value: (_u, v) => (v == null ? "—" : bytes(v)),
                },
              ]
            : [
                {
                  label: "内存",
                  stroke: accent,
                  width: 1.5,
                  fill: `${accent}1a`,
                  value: (_u, v) => (v == null ? "—" : bytes(v)),
                },
              ]}
        />

        <!-- 3. Network Rate Chart -->
        <UPlotChart
          title="网络速率"
          subtitle={m ? `↓ ${speed(m.net_rx)} · ↑ ${speed(m.net_tx)}` : ""}
          partialBuckets={processedMetrics.partialBuckets}
          data={processedMetrics.hasNetMax
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
          series={processedMetrics.hasNetMax
            ? [
                {
                  label: "下行均值",
                  stroke: accent,
                  width: 1.5,
                  fill: `${accent}15`,
                  value: (_u, v) => (v == null ? "—" : speed(v)),
                },
                {
                  label: "上行均值",
                  stroke: "#16a34a",
                  width: 1.5,
                  value: (_u, v) => (v == null ? "—" : speed(v)),
                },
                {
                  label: "下行峰值",
                  stroke: accent,
                  width: 1,
                  dash: [2, 2],
                  value: (_u, v) => (v == null ? "—" : speed(v)),
                },
                {
                  label: "上行峰值",
                  stroke: "#16a34a",
                  width: 1,
                  dash: [2, 2],
                  value: (_u, v) => (v == null ? "—" : speed(v)),
                },
              ]
            : [
                {
                  label: "下行",
                  stroke: accent,
                  width: 1.5,
                  fill: `${accent}15`,
                  value: (_u, v) => (v == null ? "—" : speed(v)),
                },
                {
                  label: "上行",
                  stroke: "#16a34a",
                  width: 1.5,
                  value: (_u, v) => (v == null ? "—" : speed(v)),
                },
              ]}
        />

        <!-- 4. TCP / UDP / Procs Chart (hidden when absent per SPEC §5.15) -->
        {#if hasConnMetrics}
          <UPlotChart
            title="TCP / UDP / 进程数"
            partialBuckets={processedMetrics.partialBuckets}
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
                stroke: "#16a34a",
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

      <!-- 5. Ping Latency & Loss Chart -->
      {#if processedPing}
        <div class="lg:col-span-2 space-y-4">
          <UPlotChart
            title="Ping 延迟"
            subtitle={processedPing.probeInfos
              .map((p) => (p.totalLoss !== null && p.totalLoss > 0 ? `${p.name} 丢包 ${p.totalLoss.toFixed(1)}%` : `${p.name}`))
              .join(" · ")}
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
              data={processedPing.lossData}
              yMin={0}
              yMax={100}
              height={140}
              yFormat={(v) => `${Math.round(v)}%`}
              series={processedPing.probeInfos.map((p) => ({
                label: `${p.name} 丢包`,
                stroke: p.color,
                width: 1.25,
                value: (_u, v) => (v == null ? "0%" : `${v.toFixed(1)}%`),
              }))}
            />
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
