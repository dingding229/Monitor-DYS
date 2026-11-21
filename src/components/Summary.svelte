<script lang="ts">
  import WorldMap from "@/components/WorldMap.svelte"
  import type { Node } from "@/lib/api"
  import { summarizeValue } from "@/lib/finance"
  import { bytes, money, percentNum, speed } from "@/lib/format"
  import { convert, type Rates } from "@/lib/rates"

  let {
    nodes,
    mapNodes,
    accent = "#10b981",
    showSummary = true,
    showMap = true,
    showBilling = true,
    financeCurrency = "CNY",
    exchangeRateEnabled = true,
    rates = null,
    selectedCountry = $bindable<string | null>(null),
  }: {
    nodes: Node[]
    mapNodes?: Node[]
    accent?: string
    showSummary?: boolean
    showMap?: boolean
    showBilling?: boolean
    financeCurrency?: string
    exchangeRateEnabled?: boolean
    rates?: Rates | null
    selectedCountry?: string | null
  } = $props()

  function splitValUnit(formatted: string): { val: string; unit: string } {
    const idx = formatted.indexOf(" ")
    if (idx === -1) return { val: formatted, unit: "" }
    return {
      val: formatted.slice(0, idx),
      unit: formatted.slice(idx + 1),
    }
  }

  let memUsed = $derived(
    nodes.reduce((acc, n) => acc + (n.metrics ? n.metrics.mem_used : 0), 0),
  )
  let memTotal = $derived(
    nodes.reduce((acc, n) => acc + (n.metrics?.mem_total || n.mem_total || 0), 0),
  )
  let memPct = $derived(percentNum(memUsed, memTotal))
  let memUsedParts = $derived(splitValUnit(bytes(memUsed)))

  let diskUsed = $derived(
    nodes.reduce((acc, n) => acc + (n.metrics ? n.metrics.disk_used : 0), 0),
  )
  let diskTotal = $derived(
    nodes.reduce((acc, n) => acc + (n.metrics?.disk_total || n.disk_total || 0), 0),
  )
  let diskPct = $derived(percentNum(diskUsed, diskTotal))
  let diskUsedParts = $derived(splitValUnit(bytes(diskUsed)))

  let effectiveRates = $derived(exchangeRateEnabled ? rates : null)
  let valueSum = $derived(summarizeValue(nodes, financeCurrency, effectiveRates))

  let currencyBreakdownList = $derived.by(() => {
    const entries = Object.entries(valueSum.byCurrency)
    return entries.map(([curr, origAmt]) => {
      const convAmt =
        curr === financeCurrency
          ? origAmt
          : effectiveRates
            ? convert(origAmt, curr, financeCurrency, effectiveRates)
            : null
      return {
        curr,
        origText: money(origAmt, curr),
        convText: convAmt !== null ? money(convAmt, financeCurrency) : null,
      }
    })
  })

  let showBreakdown = $state<boolean>(false)

  let nowTx = $derived(
    nodes.reduce((acc, n) => acc + (n.online && n.metrics ? n.metrics.net_tx : 0), 0),
  )
  let nowRx = $derived(
    nodes.reduce((acc, n) => acc + (n.online && n.metrics ? n.metrics.net_rx : 0), 0),
  )
  let txParts = $derived(splitValUnit(speed(nowTx)))
  let rxParts = $derived(splitValUnit(speed(nowRx)))

  function nodeMonthRx(n: Node): number {
    return typeof n.month_rx === "number" ? n.month_rx : (n.metrics?.month_rx ?? 0)
  }
  function nodeMonthTx(n: Node): number {
    return typeof n.month_tx === "number" ? n.month_tx : (n.metrics?.month_tx ?? 0)
  }
  function nodeTotalRx(n: Node): number {
    return typeof n.total_rx === "number" ? n.total_rx : (n.metrics?.total_rx ?? 0)
  }
  function nodeTotalTx(n: Node): number {
    return typeof n.total_tx === "number" ? n.total_tx : (n.metrics?.total_tx ?? 0)
  }

  let monthRx = $derived(nodes.reduce((acc, n) => acc + nodeMonthRx(n), 0))
  let monthTx = $derived(nodes.reduce((acc, n) => acc + nodeMonthTx(n), 0))
  let monthSum = $derived(monthRx + monthTx)
  let monthParts = $derived(splitValUnit(bytes(monthSum)))

  let totalRx = $derived(nodes.reduce((acc, n) => acc + nodeTotalRx(n), 0))
  let totalTx = $derived(nodes.reduce((acc, n) => acc + nodeTotalTx(n), 0))
  let totalSum = $derived(totalRx + totalTx)

  let onlineCount = $derived(nodes.filter((n) => n.online).length)
</script>

{#if showSummary || showMap}
  <section
    data-testid="summary"
    aria-label="节点总览 ({onlineCount} / {nodes.length} 在线)"
    class="grid grid-cols-1 gap-3 {showSummary && showMap ? 'min-[900px]:grid-cols-12' : ''}"
  >
    <span class="sr-only">{onlineCount} / {nodes.length}</span>

    {#if showSummary}
      <div
        class="grid grid-cols-2 gap-3 sm:grid-cols-3 {showMap ? 'min-[900px]:col-span-6' : ''}"
      >
        <!-- 1. 内存用量 -->
        <div
          data-testid="summary-tile"
          class="flex flex-col justify-between rounded-[10px] border border-neutral-200 bg-white p-3"
        >
          <div class="flex items-center justify-between text-[12px] text-neutral-500">
            <span>内存用量</span>
            <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="2" y="4.5" width="12" height="7" rx="1.5" />
                <path d="M5 7v2M8 7v2M11 7v2" />
              </svg>
            </span>
          </div>
          <div class="tnum mt-2 flex items-baseline gap-1 truncate">
            <span class="text-[22px] leading-none font-bold text-neutral-900">{memUsedParts.val}</span>
            <span class="text-[12px] text-neutral-500">{memUsedParts.unit} / {bytes(memTotal)}</span>
          </div>
          <div class="mt-2 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              class="h-full rounded-full transition-[width] duration-300"
              style="width: {Math.min(100, memPct)}%; background-color: var(--accent);"
            ></div>
          </div>
        </div>

        <!-- 2. 剩余价值 (with exchange rate conversion & breakdown popover) -->
        <!-- svelte-ignore a11y_no_static_element_interactions, a11y_no_noninteractive_tabindex -->
        <div
          data-testid="summary-tile"
          onmouseenter={() => (showBreakdown = true)}
          onmouseleave={() => (showBreakdown = false)}
          onclick={() => (showBreakdown = !showBreakdown)}
          onkeydown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), (showBreakdown = !showBreakdown))}
          role={showBilling && currencyBreakdownList.length > 0 ? "button" : undefined}
          tabindex={showBilling && currencyBreakdownList.length > 0 ? 0 : undefined}
          class="relative flex flex-col justify-between rounded-[10px] border border-neutral-200 bg-white p-3 {showBilling && currencyBreakdownList.length > 0 ? 'cursor-pointer' : ''}"
        >
          <div class="flex items-center justify-between text-[12px] text-neutral-500">
            <span>剩余价值</span>
            <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
                <circle cx="8" cy="8" r="2" />
              </svg>
            </span>
          </div>
          {#if !showBilling}
            <div class="tnum mt-2 text-[22px] leading-none font-bold text-neutral-400">—</div>
            <div class="mt-1 text-[11px] text-neutral-400">费用已隐藏</div>
          {:else}
            <div
              data-testid="remaining-value"
              class="tnum mt-2 truncate text-[22px] leading-none font-bold text-neutral-900"
            >
              {valueSum.counted > 0 ? money(valueSum.amount, financeCurrency) : "—"}
            </div>
            <div class="tnum mt-1 truncate text-[11px] text-neutral-500">
              {#if valueSum.converted && effectiveRates}
                <span data-testid="rate-date">按 {effectiveRates.date} 汇率折算</span>
                {#if valueSum.skipped > 0}
                  <span> · {valueSum.skipped} 台未计入</span>
                {/if}
              {:else if valueSum.skipped > 0}
                {#if exchangeRateEnabled && !effectiveRates}
                  <span>{valueSum.skipped} 台未计入 · 汇率不可用</span>
                {:else}
                  <span>{valueSum.skipped} 台未计入</span>
                {/if}
              {:else if valueSum.counted > 0}
                {#if effectiveRates}
                  <span data-testid="rate-date">按 {effectiveRates.date} 汇率折算</span>
                {:else}
                  <span>已计入 {valueSum.counted} 台 ({financeCurrency})</span>
                {/if}
              {:else}
                <span>暂无计费节点</span>
              {/if}
            </div>

            {#if showBreakdown && currencyBreakdownList.length > 0}
              <div
                data-testid="value-breakdown"
                class="absolute top-full left-0 z-30 mt-1.5 w-60 rounded-lg border border-neutral-200 bg-white/98 p-2.5 text-[11.5px] shadow-md backdrop-blur"
              >
                <div class="mb-1.5 flex items-center justify-between border-b border-neutral-100 pb-1 font-semibold text-neutral-800">
                  <span>币种原值与折算 ({financeCurrency})</span>
                  {#if effectiveRates}
                    <span class="tnum text-[10px] font-normal text-neutral-400">{effectiveRates.date}</span>
                  {/if}
                </div>
                <div class="space-y-1">
                  {#each currencyBreakdownList as item (item.curr)}
                    <div class="tnum flex items-center justify-between gap-2 text-neutral-700">
                      <span class="font-medium text-neutral-500">{item.curr}</span>
                      <span>
                        {item.origText}
                        {#if item.curr !== financeCurrency}
                          <span class="text-neutral-400">
                            → {item.convText ?? "未换算"}
                          </span>
                        {/if}
                      </span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          {/if}
        </div>

        <!-- 3. 实时上行 -->
        <div
          data-testid="summary-tile"
          class="flex flex-col justify-between rounded-[10px] border border-neutral-200 bg-white p-3"
        >
          <div class="flex items-center justify-between text-[12px] text-neutral-500">
            <span>实时上行</span>
            <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M8 12.5v-9M8 3.5L4.5 7M8 3.5L11.5 7" />
              </svg>
            </span>
          </div>
          <div class="tnum mt-2 flex items-baseline gap-1 truncate">
            <span class="text-[22px] leading-none font-bold" style="color: var(--accent);">{txParts.val}</span>
            <span class="text-[12px] text-neutral-500">{txParts.unit}</span>
          </div>
          <div class="mt-1 text-[11px] text-neutral-400">本月 ↑ {bytes(monthTx)}</div>
        </div>

        <!-- 4. 硬盘用量 -->
        <div
          data-testid="summary-tile"
          class="flex flex-col justify-between rounded-[10px] border border-neutral-200 bg-white p-3"
        >
          <div class="flex items-center justify-between text-[12px] text-neutral-500">
            <span>硬盘用量</span>
            <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-50 text-orange-600">
              <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="2" y="3.5" width="12" height="9" rx="2" />
                <path d="M2 8.5h12" />
              </svg>
            </span>
          </div>
          <div class="tnum mt-2 flex items-baseline gap-1 truncate">
            <span class="text-[22px] leading-none font-bold text-neutral-900">{diskUsedParts.val}</span>
            <span class="text-[12px] text-neutral-500">{diskUsedParts.unit} / {bytes(diskTotal)}</span>
          </div>
          <div class="mt-2 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              class="h-full rounded-full transition-[width] duration-300"
              style="width: {Math.min(100, diskPct)}%; background-color: var(--accent);"
            ></div>
          </div>
        </div>

        <!-- 5. 累计流量 (本月合计，悬停显示累计) -->
        <div
          data-testid="summary-tile"
          title="累计总流量：{bytes(totalSum)}（↓ {bytes(totalRx)} / ↑ {bytes(totalTx)}）"
          class="flex flex-col justify-between rounded-[10px] border border-neutral-200 bg-white p-3"
        >
          <div class="flex items-center justify-between text-[12px] text-neutral-500">
            <span>累计流量</span>
            <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-purple-50 text-purple-600">
              <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M5 12V4M5 4L2.5 6.5M5 4l2.5 2.5M11 4v8m0 0l-2.5-2.5M11 12l2.5-2.5" />
              </svg>
            </span>
          </div>
          <div class="tnum mt-2 flex items-baseline gap-1 truncate">
            <span class="text-[22px] leading-none font-bold text-neutral-900">{monthParts.val}</span>
            <span class="text-[12px] text-neutral-500">{monthParts.unit}</span>
          </div>
          <div class="tnum mt-1 truncate text-[11px] text-neutral-400">
            总计 {bytes(totalSum)}
          </div>
        </div>

        <!-- 6. 实时下行 -->
        <div
          data-testid="summary-tile"
          class="flex flex-col justify-between rounded-[10px] border border-neutral-200 bg-white p-3"
        >
          <div class="flex items-center justify-between text-[12px] text-neutral-500">
            <span>实时下行</span>
            <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-50 text-sky-600">
              <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M8 3.5v9m0 0L4.5 9M8 12.5L11.5 9" />
              </svg>
            </span>
          </div>
          <div class="tnum mt-2 flex items-baseline gap-1 truncate">
            <span class="text-[22px] leading-none font-bold text-sky-600">{rxParts.val}</span>
            <span class="text-[12px] text-neutral-500">{rxParts.unit}</span>
          </div>
          <div class="mt-1 text-[11px] text-neutral-400">本月 ↓ {bytes(monthRx)}</div>
        </div>
      </div>
    {/if}

    {#if showMap}
      <div class={showSummary ? "min-[900px]:col-span-6 flex flex-col [&>*]:flex-1" : ""}>
        <WorldMap
          nodes={mapNodes ?? nodes}
          {accent}
          bind:selectedCountry
        />
      </div>
    {/if}
  </section>
{/if}
