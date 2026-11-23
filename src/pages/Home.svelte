<script lang="ts">
  import type { createApp } from "@/lib/app-state.svelte"
  import { batchLimit } from "@/lib/viewport.svelte"
  import NodeCard from "@/components/NodeCard.svelte"
  import Summary from "@/components/Summary.svelte"
  import { ALL_GROUP } from "@/lib/api"
  import { regionName } from "@/lib/format"
  import type { SortKey } from "@/lib/view-state"

  let { app }: { app: ReturnType<typeof createApp> } = $props()

  let tableModule = $derived(app.layout === "table" ? import("@/components/NodeTable.svelte") : null)

  let total = $derived(app.home.directory.list.length)
  const limit = batchLimit(() => total)
  let batch = $derived(app.home.directory.list.slice(0, limit()))
  let showPing = $derived(app.pingEnabled && !app.snapshotOnly)
  let input = $state<HTMLInputElement>()

  function shortcuts(e: KeyboardEvent) {
    if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === "Escape") app.setQuery("")
    if (e.key === "/" && input && !(e.target instanceof HTMLElement && e.target.closest("input,textarea,select,[contenteditable=true]"))) {
      e.preventDefault()
      input.focus()
    }
  }
</script>

<svelte:window onkeydown={shortcuts} />

<div class="space-y-3">
  <Summary
    summary={app.home.summary}
    mapNodes={app.home.directory.grouped}
    accent={app.config.accent}
    showSummary={app.config.show_summary}
    showMap={app.config.show_map}
    loading={app.loading}
    selectedCountry={app.country}
    onSelectCountry={(c) => app.setCountry(c)}
  />

  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
      {#if app.loading}
        <div class="bone h-[30px] w-52"></div>
      {:else if app.home.directory.tabs.length > 0}
        <div role="tablist" aria-label="节点分组" class="scroll-hint min-w-0 max-w-full overflow-x-auto py-0.5">
          <div class="flex w-max items-center gap-1.5">
            {#each app.home.directory.tabs as tab (tab.key)}
              <button
                type="button"
                role="tab"
                data-testid="group-tab"
                aria-selected={app.group === tab.key}
                onclick={() => app.setGroup(tab.key)}
                class="tab"
              >
                <span>{tab.label}</span>
                <span class="cnt tnum">{tab.count}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#if app.country}
        <button
          type="button"
          data-testid="country-filter-chip"
          onclick={() => app.setCountry(null)}
          class="filter-chip"
        >
          <span>地区：{regionName(app.country)}</span>
          <span aria-hidden="true">×</span>
        </button>
      {/if}
    </div>

    <div class="directory-controls flex flex-wrap items-center gap-2">
      <div class="seg" role="group" aria-label="视图切换">
        {#each ["grid", "table"] as const as mode}
          {@const label = mode === "grid" ? "卡片" : "列表"}
          <button
            type="button"
            aria-label="{label}视图"
            title="{label}视图"
            aria-pressed={app.layout === mode}
            onclick={() => app.setLayout(mode)}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d={mode === "grid" ? "M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z" : "M2 3h12v10H2zM2 6.5h12M2 10h12"} />
            </svg>{label}
          </button>
        {/each}
      </div>

      {#if app.config.show_sort}
        <select
          data-testid="sort-select"
          aria-label="排序方式"
          value={app.sort}
          onchange={(e) => app.setSort((e.currentTarget as HTMLSelectElement).value as SortKey)}
          class="ctrl cursor-pointer"
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

      {#if app.config.show_search}
        <div class="search-wrap relative flex items-center">
          <svg
            class="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[var(--fg-subtle)]"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            type="search"
            data-testid="search-input"
            placeholder="搜索节点…"
            aria-label="搜索名称、地区、系统或备注"
            bind:this={input}
            value={app.query}
            oninput={(e) => app.setQuery((e.currentTarget as HTMLInputElement).value)}
            class="ctrl w-44 pr-2.5 pl-7 sm:w-52"
          />
        </div>
      {/if}
    </div>
  </div>

  {#if app.loading}
    <div data-testid="skeleton" aria-label="正在加载节点" aria-busy="true" class="node-grid" class:standard={app.config.card_size === "standard"}>
      {#each Array(10) as _}
        <div class="panel card-placeholder" aria-hidden="true">
          <div class="bone h-3.5 w-3/5"></div>
          <div class="bone h-2.5 w-2/5"></div>
          <div class="mt-2 grid grid-cols-2 gap-3">
            <div class="bone h-7"></div>
            <div class="bone h-7"></div>
            <div class="bone h-7"></div>
            <div class="bone h-7"></div>
          </div>
          <div class="bone mt-auto h-9"></div>
        </div>
      {/each}
    </div>
  {:else if total === 0}
    <div data-testid="empty-state" class="panel py-10 text-center">
      <svg aria-hidden="true" class="mx-auto mb-2.5 text-[var(--fg-subtle)]" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 5 5" />
      </svg>
      <p class="text-[14px] font-bold text-[var(--fg)]">没有匹配的节点</p>
      <p class="mt-1 text-[12px] text-[var(--fg-subtle)]">当前筛选条件或搜索关键词下暂无结果</p>
      <button
        type="button"
        class="btn btn-primary mt-3 px-3.5"
        onclick={() => {
          app.setGroup(ALL_GROUP)
          app.setCountry(null)
          app.setQuery("")
        }}
      >
        清除筛选
      </button>
    </div>
  {:else if tableModule}
    {#await tableModule then { default: NodeTable }}
      <NodeTable
        ping={app.ping}
        {showPing}
        snapshotOnly={app.snapshotOnly}
        nodes={batch}
        {total}
        showBilling={app.config.show_billing}
        expiryWarningDays={app.config.expiry_warning_days}
        onSelect={(id) => app.selectNode(id)}
      />
    {/await}
  {:else}
    <div class="node-grid" class:standard={app.config.card_size === "standard"}>
      {#each batch as node (node.id)}
        <NodeCard
          defer={total > 60}
          {node}
          ping={app.ping}
          {showPing}
          snapshotOnly={app.snapshotOnly}
          showBilling={app.config.show_billing}
          expiryWarningDays={app.config.expiry_warning_days}
          onSelect={(id) => app.selectNode(id)}
        />
      {/each}
      {#each Array(total - batch.length) as _}
        <div class="node-space" aria-hidden="true"></div>
      {/each}
    </div>
  {/if}
</div>
