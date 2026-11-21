<script lang="ts">
  import type { PingStore } from "@/lib/ping.svelte"
  import NodeCard from "@/components/NodeCard.svelte"
  import NodeTable from "@/components/NodeTable.svelte"
  import Summary from "@/components/Summary.svelte"
  import { ALL_GROUP, UNGROUPED, groupsOf, type GroupKey, type Node } from "@/lib/api"
  import { expiry, percentNum, regionName } from "@/lib/format"
  import { fadeOverflow } from "@/lib/fadeOverflow"
  import type { SortKey } from "@/lib/prefs"

  let {
    ping, showPing, snapshotOnly, nodes, loading = false,
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
    sortKey = $bindable<SortKey>("default"),
    searchQuery = $bindable<string>(""),
    onChangeLayout,
    onChangeSort,
    onSelectNode,
    onUpdateOrderedNodes,
  }: {
    ping: PingStore
    snapshotOnly: boolean
    showPing: boolean
    nodes: Node[]
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
    onUpdateOrderedNodes?: (ordered: Node[]) => void
  } = $props()

  let groups = $derived(groupsOf(nodes))
  let ungroupedCount = $derived(nodes.filter((n) => !n.group).length)
  let hasSomeGrouped = $derived(groups.length > 0)
  let showUngroupedTab = $derived(hasSomeGrouped && ungroupedCount > 0)

  let activeGroup = $derived.by<GroupKey>(() => {
    if (!hasSomeGrouped) return ALL_GROUP
    if (selectedGroup === ALL_GROUP) return ALL_GROUP
    if (selectedGroup === UNGROUPED) return showUngroupedTab ? UNGROUPED : ALL_GROUP
    if (typeof selectedGroup === "string" && groups.includes(selectedGroup)) return selectedGroup
    return ALL_GROUP
  })

  $effect(() => {
    if (activeGroup !== selectedGroup) {
      selectedGroup = activeGroup
    }
  })

  // 1. Group filtered nodes
  let groupFilteredNodes = $derived.by(() => {
    if (activeGroup === ALL_GROUP) return nodes
    if (activeGroup === UNGROUPED) return nodes.filter((n) => !n.group)
    return nodes.filter((n) => n.group === activeGroup)
  })

  // 2. Country filtered nodes (Summary numbers follow group + country filter per SPEC-v1.2 §7)
  let countryFilteredNodes = $derived.by(() => {
    if (!selectedCountry) return groupFilteredNodes
    const target = selectedCountry.toUpperCase()
    return groupFilteredNodes.filter((n) => (n.country || "").trim().toUpperCase() === target)
  })

  // 3. Search filtered nodes (matches name, country, os, public_remark case-insensitively)
  let searchFilteredNodes = $derived.by(() => {
    const q = (searchQuery || "").trim().toLowerCase()
    if (!q || !showSearch) return countryFilteredNodes
    return countryFilteredNodes.filter((n) => {
      const name = (n.name || "").toLowerCase()
      const country = (n.country || "").toLowerCase()
      const cName = regionName(n.country).toLowerCase()
      const os = (n.os || "").toLowerCase()
      const remark = (n.public_remark || "").toLowerCase()
      return (
        name.includes(q) ||
        country.includes(q) ||
        cName.includes(q) ||
        os.includes(q) ||
        remark.includes(q)
      )
    })
  })

  // 4. Sorted nodes
  let displayedNodes = $derived.by(() => {
    const list = [...searchFilteredNodes]
    const defaultCmp = (a: Node, b: Node) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id

    if (!showSort || sortKey === "default") {
      return list.sort(defaultCmp)
    }

    return list.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return (a.name || "").localeCompare(b.name || "", "zh-CN") || defaultCmp(a, b)
        case "cpu": {
          const ca = a.online && a.metrics ? a.metrics.cpu : -1
          const cb = b.online && b.metrics ? b.metrics.cpu : -1
          return cb - ca || defaultCmp(a, b)
        }
        case "mem": {
          const ma = a.online && a.metrics ? percentNum(a.metrics.mem_used, a.metrics.mem_total) : -1
          const mb = b.online && b.metrics ? percentNum(b.metrics.mem_used, b.metrics.mem_total) : -1
          return mb - ma || defaultCmp(a, b)
        }
        case "disk": {
          const da = a.online && a.metrics ? percentNum(a.metrics.disk_used, a.metrics.disk_total) : -1
          const db = b.online && b.metrics ? percentNum(b.metrics.disk_used, b.metrics.disk_total) : -1
          return db - da || defaultCmp(a, b)
        }
        case "tx": {
          const ta = a.online && a.metrics ? a.metrics.net_tx : -1
          const tb = b.online && b.metrics ? b.metrics.net_tx : -1
          return tb - ta || defaultCmp(a, b)
        }
        case "rx": {
          const ra = a.online && a.metrics ? a.metrics.net_rx : -1
          const rb = b.online && b.metrics ? b.metrics.net_rx : -1
          return rb - ra || defaultCmp(a, b)
        }
        case "traffic": {
          const ua = (a.month_rx ?? 0) + (a.month_tx ?? 0)
          const ub = (b.month_rx ?? 0) + (b.month_tx ?? 0)
          return ub - ua || defaultCmp(a, b)
        }
        case "expiry": {
          const ea = expiry(a).days
          const eb = expiry(b).days
          const va = ea === null ? Number.POSITIVE_INFINITY : ea
          const vb = eb === null ? Number.POSITIVE_INFINITY : eb
          return va - vb || defaultCmp(a, b)
        }
        default:
          return defaultCmp(a, b)
      }
    })
  })

  $effect(() => {
    onUpdateOrderedNodes?.(displayedNodes)
  })

  type TabItem = { key: GroupKey; label: string; count: number }

  let tabs = $derived.by<TabItem[]>(() => {
    if (!hasSomeGrouped) return []
    const list: TabItem[] = [{ key: ALL_GROUP, label: "全部", count: nodes.length }]
    for (const g of groups) {
      list.push({
        key: g,
        label: g,
        count: nodes.filter((n) => n.group === g).length,
      })
    }
    if (showUngroupedTab) {
      list.push({
        key: UNGROUPED,
        label: "未分组",
        count: ungroupedCount,
      })
    }
    return list
  })
</script>

<div class="space-y-3">
  <!-- 1. Overview Section (Summary 3x2 + WorldMap) -->
  <Summary
    nodes={searchFilteredNodes}
    mapNodes={groupFilteredNodes}
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
      {:else if tabs.length > 0}
        <div
          use:fadeOverflow
          role="tablist"
          aria-label="节点分组"
          class="min-w-0 max-w-full overflow-x-auto py-0.5"
        >
          <div class="flex w-max items-center gap-1.5">
          {#each tabs as tab (tab.key)}
            {@const isActive = activeGroup === tab.key}
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
        <button
          type="button"
          onclick={() => onChangeLayout?.("grid")}
          title="卡片视图"
          aria-label="卡片视图"
          aria-pressed={layout === "grid"}
          class="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[12px] transition-colors {layout === 'grid'
            ? 'bg-neutral-100 font-medium text-neutral-900'
            : 'text-neutral-500 hover:text-neutral-800'}"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="2" width="5" height="5" rx="1" />
            <rect x="9" y="2" width="5" height="5" rx="1" />
            <rect x="2" y="9" width="5" height="5" rx="1" />
            <rect x="9" y="9" width="5" height="5" rx="1" />
          </svg>
          <span>卡片</span>
        </button>
        <button
          type="button"
          onclick={() => onChangeLayout?.("table")}
          title="列表视图"
          aria-label="列表视图"
          aria-pressed={layout === "table"}
          class="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[12px] transition-colors {layout === 'table'
            ? 'bg-neutral-100 font-medium text-neutral-900'
            : 'text-neutral-500 hover:text-neutral-800'}"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
            <path d="M2 6.5h12M2 10h12" />
          </svg>
          <span>列表</span>
        </button>
      </div>

      {#if showSort}
        <select
          data-testid="sort-select"
          aria-label="排序方式"
          value={sortKey}
          onchange={(e) => {
            const next = (e.currentTarget as HTMLSelectElement).value as SortKey
            sortKey = next
            onChangeSort?.(next)
          }}
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
            bind:value={searchQuery}
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
  {:else if displayedNodes.length === 0}
    <div data-testid="empty-state" class="panel py-12 text-center">
      <svg aria-hidden="true" class="mx-auto mb-3 text-neutral-400" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/></svg>
      <p class="font-semibold">没有匹配的节点</p>
      <button type="button" class="primary mt-3" onclick={() => {selectedGroup = ALL_GROUP; selectedCountry = null; searchQuery = ""}}>清除筛选</button>
    </div>
  {:else if layout === "table"}
    <NodeTable
      {ping} {showPing} {snapshotOnly} nodes={displayedNodes}
      {showBilling}
      {expiryWarningDays}
      onSelect={onSelectNode}
    />
  {:else}
    <div
      class="node-grid" class:standard={cardSize === "standard"}
    >
      {#each displayedNodes as node (node.id)}
        <NodeCard
          {node} {ping} {showPing} {snapshotOnly}
          {showBilling}
          {expiryWarningDays}
          onSelect={onSelectNode}
        />
      {/each}
    </div>
  {/if}
</div>
