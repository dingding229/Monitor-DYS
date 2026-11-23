<script lang="ts">
  import type { PingStore } from "@/lib/ping.svelte"
  import { batchLimit } from "@/lib/viewport.svelte"
  import NodeCard from "@/components/NodeCard.svelte"
  import NodeTable from "@/components/NodeTable.svelte"
  import Summary from "@/components/Summary.svelte"
  import { ALL_GROUP, type GroupKey } from "@/lib/api"
  import { regionName } from "@/lib/format"
  import type { SortKey, Directory } from "@/lib/view-state"

  let {
    ping, showPing, snapshotOnly, filtered, loading = false,
    accent = "#10b981",
    layout = "grid",
    cardSize = "compact",
    showSummary = true,
    showMap = true,
    showSearch = true,
    showSort = true,
    showBilling = true,
    expiryWarningDays = 7,
    selectedGroup = $bindable<GroupKey>(ALL_GROUP),
    selectedCountry = $bindable<string | null>(null),
    sortKey = "default",
    searchQuery = $bindable<string>(""),
    onChangeLayout,
    onChangeSort,
    onSelectNode,
  }: {
    ping: PingStore
    snapshotOnly: boolean
    showPing: boolean
    filtered: Directory
    loading?: boolean
    accent?: string
    layout?: "grid" | "table"
    cardSize?: "compact" | "standard"
    showSummary?: boolean
    showMap?: boolean
    showSearch?: boolean
    showSort?: boolean
    showBilling?: boolean
    expiryWarningDays?: number
    selectedGroup?: GroupKey
    selectedCountry?: string | null
    sortKey?: SortKey
    searchQuery?: string
    onChangeLayout?: (layout: "grid" | "table") => void
    onChangeSort?: (sort: SortKey) => void
    onSelectNode: (id: number) => void
  } = $props()

  let total=$derived(filtered.list.length)
  const limit = batchLimit(()=>total)
  let batch=$derived(filtered.list.slice(0,limit()))
  let input = $state<HTMLInputElement>()
  function shortcuts(e: KeyboardEvent) {
    if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return
    if(e.key === 'Escape') searchQuery = ''
    if(e.key === '/' && input && !(e.target instanceof HTMLElement && e.target.closest('input,textarea,select,[contenteditable=true]'))) { e.preventDefault(); input.focus() }
  }
</script>
<svelte:window onkeydown={shortcuts} />

<div class="space-y-3">
  <!-- 1. Overview Section (Summary 3x2 + WorldMap) -->
  <Summary
    nodes={filtered.list}
    mapNodes={filtered.grouped}
    {accent}
    {showSummary}
    {showMap}
    {loading}
    bind:selectedCountry
  />

  <!-- 2. Toolbar: Group Tabs + Country Filter Chip + Layout Switch + Sort Select + Search Input -->
  <div class="flex flex-wrap items-center justify-between gap-2">
    <!-- Left: Group Tabs & Country Filter Chip -->
    <div class="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
      {#if loading}
        <div class="bone h-7 w-52"></div>
      {:else if filtered.tabs.length > 0}
        <div
          role="tablist"
          aria-label="节点分组"
          class="scroll-hint min-w-0 max-w-full overflow-x-auto py-0.5"
        >
          <div class="flex w-max items-center gap-1.5">
          {#each filtered.tabs as tab (tab.key)}
            {@const isActive = selectedGroup === tab.key}
            <button
              type="button"
              role="tab"
              data-testid="group-tab"
              aria-selected={isActive}
              onclick={() => (selectedGroup = tab.key)}
              class="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1 text-[12px] font-medium transition-colors {isActive
                ? 'border-transparent text-white'
                : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'}"
              style={isActive ? "background-color: var(--accent);" : ""}
            >
              <span>{tab.label}</span>
              <span
                class="tnum rounded-full px-1.5 text-[11px] {isActive
                  ? 'bg-white text-neutral-800'
                  : 'bg-neutral-100 text-neutral-500'}"
              >
                {tab.count}
              </span>
            </button>
          {/each}
          </div>
        </div>
      {/if}

      {#if selectedCountry}
        <button
          type="button"
          data-testid="country-filter-chip"
          onclick={() => (selectedCountry = null)}
          class="inline-flex cursor-pointer items-center gap-1 rounded-full border border-neutral-300 bg-neutral-900 px-2.5 py-1 text-[12px] font-medium text-white transition-opacity hover:opacity-85"
        >
          <span>地区：{regionName(selectedCountry)}</span>
          <span class="ml-0.5 text-neutral-300">×</span>
        </button>
      {/if}
    </div>

    <!-- Right: View switcher + Sort dropdown + Search box -->
    <div class="directory-controls flex flex-wrap items-center gap-2">
      <!-- View Switcher (Grid / Table) -->
      <div class="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5">
        {#each ['grid','table'] as const as mode}
          {@const label=mode==='grid'?'卡片':'列表'}
          <button type="button" aria-label="{label}视图" title="{label}视图" aria-pressed={layout===mode} onclick={()=>onChangeLayout?.(mode)}
            class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px]" class:bg-neutral-100={layout===mode}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d={mode==='grid'?'M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z':'M2 3h12v10H2zM2 6h12M2 10h12'}/></svg>{label}
          </button>
        {/each}
      </div>

      {#if showSort}
        <select
          data-testid="sort-select"
          aria-label="排序方式"
          value={sortKey}
          onchange={(e) => onChangeSort?.(e.currentTarget.value as SortKey)}
          class="h-7 cursor-pointer rounded-lg border border-neutral-200 bg-white px-2.5 text-[12px] text-neutral-700 outline-none focus:border-neutral-400"
        >
          <option value="default">默认顺序</option>
          <option value="name">名称</option>
          <option value="cpu">CPU</option>
          <option value="mem">内存</option>
          <option value="disk">硬盘</option>
          <option value="tx">上行</option>
          <option value="rx">下行</option>
          <option value="expiry">到期</option>
        </select>
      {/if}

      {#if showSearch}
        <div class="relative flex items-center">
          <svg
            class="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-neutral-400"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            type="search"
            data-testid="search-input"
            placeholder="搜索节点…"
            aria-label="搜索名称、地区、系统或备注"
            bind:this={input} bind:value={searchQuery}
            class="h-7 w-44 rounded-lg border border-neutral-200 bg-white pr-2.5 pl-7 text-[12px] text-neutral-800 placeholder:text-neutral-400 outline-none focus:border-neutral-400 sm:w-52"
          />
        </div>
      {/if}
    </div>
  </div>

  <!-- 3. Node Grid or Table -->
  {#if loading}
    <div data-testid="skeleton" aria-label="正在加载节点" aria-busy="true" class="node-grid" class:standard={cardSize === 'standard'}>
      {#each Array(10) as _}<div class="panel card-placeholder" aria-hidden="true"><i class="bone"></i><i class="bone"></i><div class="ghost-meters"></div><i class="bone"></i></div>{/each}
    </div>
  {:else if filtered.list.length === 0}
    <div data-testid="empty-state" class="panel py-12 text-center">
      <svg aria-hidden="true" class="mx-auto mb-3 text-neutral-400" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/></svg>
      <p class="font-semibold">没有匹配的节点</p>
      <button type="button" class="primary mt-3" onclick={() => {selectedGroup = ALL_GROUP; selectedCountry = null; searchQuery = ""}}>清除筛选</button>
    </div>
  {:else if layout === "table"}
    <NodeTable
      {ping} {showPing} {snapshotOnly} nodes={batch} {total}
      {showBilling}
      {expiryWarningDays}
      onSelect={onSelectNode}
    />
  {:else}
    <div
      class="node-grid" class:standard={cardSize === "standard"}
    >
      {#each batch as node (node.id)}
        <NodeCard
          defer={total>60} {node} {ping} {showPing} {snapshotOnly}
          {showBilling}
          {expiryWarningDays}
          onSelect={onSelectNode}
        />
      {/each}
      {#each Array(total-batch.length) as _}<div class="node-space" aria-hidden="true"></div>{/each}
    </div>
  {/if}
</div>
