<script lang="ts">
  import NodeCard from "@/components/NodeCard.svelte"
  import NodeTable from "@/components/NodeTable.svelte"
  import Summary from "@/components/Summary.svelte"
  import { ALL_GROUP, UNGROUPED, groupsOf, type GroupKey, type Node } from "@/lib/api"

  let {
    nodes,
    layout = "grid",
    showSummary = true,
    showBilling = true,
    selectedGroup = $bindable<GroupKey>(ALL_GROUP),
    onSelectNode,
  }: {
    nodes: Node[]
    layout?: "grid" | "table"
    showSummary?: boolean
    showBilling?: boolean
    selectedGroup?: GroupKey
    onSelectNode: (id: number) => void
  } = $props()

  let groups = $derived(groupsOf(nodes))
  let ungroupedCount = $derived(nodes.filter((n) => !n.group).length)
  let hasSomeGrouped = $derived(groups.length > 0)
  let showUngroupedTab = $derived(hasSomeGrouped && ungroupedCount > 0)

  // Validate selectedGroup; fall back to ALL_GROUP if the active group disappeared
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

  let filteredNodes = $derived.by(() => {
    if (activeGroup === ALL_GROUP) return nodes
    if (activeGroup === UNGROUPED) return nodes.filter((n) => !n.group)
    return nodes.filter((n) => n.group === activeGroup)
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

<div class="space-y-4">
  {#if showSummary}
    <Summary nodes={filteredNodes} group={activeGroup} />
  {/if}

  {#if tabs.length > 0}
    <div
      role="tablist"
      aria-label="节点分组"
      class="flex items-center gap-1.5 overflow-x-auto pb-1"
    >
      {#each tabs as tab (tab.key)}
        {@const isActive = activeGroup === tab.key}
        <button
          type="button"
          role="tab"
          data-testid="group-tab"
          aria-selected={isActive}
          onclick={() => (selectedGroup = tab.key)}
          class="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors {isActive
            ? 'border-transparent text-white'
            : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'}"
          style={isActive ? "background-color: var(--accent);" : ""}
        >
          <span>{tab.label}</span>
          <span
            class="tnum rounded px-1 text-[11px] {isActive
              ? 'bg-white/20 text-white'
              : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'}"
          >
            {tab.count}
          </span>
        </button>
      {/each}
    </div>
  {/if}

  {#if filteredNodes.length === 0}
    <div class="rounded-[12px] border border-neutral-200 bg-white py-16 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
      暂无节点
    </div>
  {:else if layout === "table"}
    <NodeTable nodes={filteredNodes} {showBilling} onSelect={onSelectNode} />
  {:else}
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {#each filteredNodes as node (node.id)}
        <NodeCard {node} {showBilling} onSelect={onSelectNode} />
      {/each}
    </div>
  {/if}
</div>
