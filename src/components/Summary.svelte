<script lang="ts">
  import { speedHistory, type GroupKey, type Node } from "@/lib/api"
  import { bytes, speed } from "@/lib/format"

  let {
    nodes,
    group,
  }: {
    nodes: Node[]
    group: GroupKey
  } = $props()

  let onlineCount = $derived(nodes.filter((n) => n.online).length)
  let totalCount = $derived(nodes.length)

  function nodeMonthRx(n: Node): number {
    return typeof n.month_rx === "number" ? n.month_rx : (n.metrics?.month_rx ?? 0)
  }
  function nodeMonthTx(n: Node): number {
    return typeof n.month_tx === "number" ? n.month_tx : (n.metrics?.month_tx ?? 0)
  }

  let monthRx = $derived(nodes.reduce((acc, n) => acc + nodeMonthRx(n), 0))
  let monthTx = $derived(nodes.reduce((acc, n) => acc + nodeMonthTx(n), 0))
  let monthTotal = $derived(monthRx + monthTx)

  let nowRx = $derived(
    nodes.reduce((acc, n) => acc + (n.online && n.metrics ? n.metrics.net_rx : 0), 0),
  )
  let nowTx = $derived(
    nodes.reduce((acc, n) => acc + (n.online && n.metrics ? n.metrics.net_tx : 0), 0),
  )

  let history = $derived.by(() => {
    // Re-evaluate when nodes update
    void nodes
    return speedHistory.get(group) ?? []
  })

  let sparkPoints = $derived.by(() => {
    const raw = history.length > 0 ? history : [{ rx: nowRx, tx: nowTx }]
    const pts = raw.length === 1 ? [raw[0], raw[0]] : raw
    const maxVal = Math.max(...pts.flatMap((p) => [p.rx, p.tx]), 1)
    const w = Math.max(pts.length - 1, 1)
    const rxLine = pts
      .map((p, i) => `${((i / w) * 100).toFixed(1)},${(22 - (p.rx / maxVal) * 20).toFixed(1)}`)
      .join(" ")
    const txLine = pts
      .map((p, i) => `${((i / w) * 100).toFixed(1)},${(22 - (p.tx / maxVal) * 20).toFixed(1)}`)
      .join(" ")
    return { rxLine, txLine }
  })
</script>

<section
  data-testid="summary"
  class="grid grid-cols-1 gap-3 sm:grid-cols-3"
  aria-label="节点汇总"
>
  <div class="rounded-[12px] border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
    <div class="text-xs text-neutral-500 dark:text-neutral-400">在线节点</div>
    <div class="tnum mt-1.5 flex items-baseline gap-2">
      <span class="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        {onlineCount} / {totalCount}
      </span>
      <span class="inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        <span
          class="inline-block h-2 w-2 rounded-full"
          style="background-color: {onlineCount > 0 ? 'var(--online)' : 'var(--offline)'};"
        ></span>
        {totalCount === 0
          ? "暂无节点"
          : onlineCount === totalCount
            ? "全部在线"
            : `${totalCount - onlineCount} 离线`}
      </span>
    </div>
  </div>

  <div class="rounded-[12px] border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
    <div class="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
      <span>本月总流量</span>
      <span class="tnum font-medium text-neutral-700 dark:text-neutral-300">{bytes(monthTotal)}</span>
    </div>
    <div class="tnum mt-2 grid grid-cols-2 gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
      <div class="truncate" title="本月下行">↓ {bytes(monthRx)}</div>
      <div class="truncate" title="本月上行">↑ {bytes(monthTx)}</div>
    </div>
  </div>

  <div class="rounded-[12px] border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
    <div class="flex items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
      <span>实时速率</span>
      <span class="tnum truncate font-medium text-neutral-800 dark:text-neutral-200">
        ↓ {speed(nowRx)} · ↑ {speed(nowTx)}
      </span>
    </div>
    <div class="mt-2">
      <svg
        viewBox="0 0 100 24"
        preserveAspectRatio="none"
        class="h-6 w-full overflow-visible"
        aria-hidden="true"
      >
        <polyline
          fill="none"
          stroke="var(--accent)"
          stroke-width="1.5"
          vector-effect="non-scaling-stroke"
          points={sparkPoints.rxLine}
        />
        <polyline
          fill="none"
          stroke="currentColor"
          class="text-neutral-400 dark:text-neutral-600"
          stroke-width="1.25"
          stroke-dasharray="2 2"
          vector-effect="non-scaling-stroke"
          points={sparkPoints.txLine}
        />
      </svg>
    </div>
  </div>
</section>
