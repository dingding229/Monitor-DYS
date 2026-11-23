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

<div class="toolbar">
  <div class="toolbar-left">
    {#if app.loading}
      <div class="bone" style="height:30px;width:208px"></div>
    {:else if app.home.directory.tabs.length > 0}
      <div role="tablist" aria-label="节点分组" class="scroll-hint tabs-scroll">
        <div class="tabs-track">
          {#each app.home.directory.tabs as tab (tab.key)}
            <button type="button" role="tab" data-testid="group-tab" aria-selected={app.group === tab.key} onclick={() => app.setGroup(tab.key)} class="tab">
              <span>{tab.label}</span>
              <span class="cnt tnum">{tab.count}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if app.country}
      <button type="button" data-testid="country-filter-chip" onclick={() => app.setCountry(null)} class="filter-chip">
        <span>地区：{regionName(app.country)}</span>
        <span aria-hidden="true">×</span>
      </button>
    {/if}
  </div>

  <div class="directory-controls">
    <div class="seg" role="group" aria-label="视图切换">
      {#each ["grid", "table"] as const as mode}
        {@const label = mode === "grid" ? "卡片" : "列表"}
        <button type="button" aria-label="{label}视图" title="{label}视图" aria-pressed={app.layout === mode} onclick={() => app.setLayout(mode)}>
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
        class="ctrl"
        style="cursor:pointer"
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
      <div class="search-wrap">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" />
        </svg>
        <input
          type="search"
          data-testid="search-input"
          placeholder="搜索节点…"
          aria-label="搜索名称、地区、系统或备注"
          bind:this={input}
          value={app.query}
          oninput={(e) => app.setQuery((e.currentTarget as HTMLInputElement).value)}
          class="ctrl"
        />
      </div>
    {/if}
  </div>
</div>

{#if app.loading}
  <div data-testid="skeleton" aria-label="正在加载节点" aria-busy="true" class="node-grid" class:standard={app.config.card_size === "standard"}>
    {#each Array(10) as _}
      <div class="panel card-placeholder" aria-hidden="true">
        <div class="bone" style="height:14px;width:60%"></div>
        <div class="bone" style="height:10px;width:40%"></div>
        <div class="skel-m">
          <div class="bone" style="height:28px"></div><div class="bone" style="height:28px"></div>
          <div class="bone" style="height:28px"></div><div class="bone" style="height:28px"></div>
        </div>
        <div class="bone" style="height:36px;margin-top:auto"></div>
      </div>
    {/each}
  </div>
{:else if total === 0}
  <div data-testid="empty-state" class="panel empty-box">
    <svg aria-hidden="true" class="fg-subtle" style="margin:0 auto 10px" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" />
    </svg>
    <p style="font-size:14px;font-weight:700">没有匹配的节点</p>
    <p class="fg-subtle" style="margin-top:4px;font-size:12px">当前筛选条件或搜索关键词下暂无结果</p>
    <button
      type="button"
      class="btn btn-primary"
      style="margin-top:12px;padding:0 14px"
      onclick={() => { app.setGroup(ALL_GROUP); app.setCountry(null); app.setQuery("") }}
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
    {#each Array(total - batch.length) as _}<div class="node-space" aria-hidden="true"></div>{/each}
  </div>
{/if}
