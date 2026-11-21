<script lang="ts">
  import { onDestroy, onMount } from "svelte"
  import VisitorBubble from "@/components/VisitorBubble.svelte"
  import Home from "@/pages/Home.svelte"
  import NodeDetail from "@/pages/NodeDetail.svelte"
  import { ALL_GROUP, UNGROUPED, ApiError, api, type GroupKey, type Me, type Node } from "@/lib/api"
  import { withAlpha } from "@/lib/color"
  import { loadConfig, resolveConfig, type ThemeConfig } from "@/lib/config"
  import { createNodeStore } from "@/lib/nodes.svelte"
  import { loadPrefs, savePref, type SortKey, type VisitorPrefs } from "@/lib/prefs"
  import { createRouter } from "@/lib/router.svelte"

  const router = createRouter()
  const nodeStore = createNodeStore({ autoStart: false })

  let me = $state<Me | null>(null)
  let meError = $state<string>("")
  let meUnauthorized = $state<boolean>(false)
  let siteConfig = $state<ThemeConfig>(resolveConfig())
  let configLoaded = $state<boolean>(false)
  let visitorPrefs = $state<VisitorPrefs>(loadPrefs())
  let selectedGroup = $state<GroupKey>(ALL_GROUP)
  let sortKey = $state<SortKey>(loadPrefs().sort ?? "default")
  let searchQuery = $state<string>("")
  let orderedNodes = $state<Node[]>([])

  // Effective layout per SPEC §5.13 & v1.1:
  // theme.json default < Hub config < visitor localStorage (only layout and sort)
  let effectiveLayout = $derived<"grid" | "table">(visitorPrefs.layout ?? siteConfig.layout)

  // Apply `--accent` and `--accent-glow` CSS variables
  $effect(() => {
    if (typeof document !== "undefined") {
      const accentColor = siteConfig.accent || "#10b981"
      document.documentElement.style.setProperty("--accent", accentColor)
      document.documentElement.style.setProperty("--accent-glow", withAlpha(accentColor, 0.07))
    }
  })

  // Sync poll_interval from siteConfig to nodeStore
  $effect(() => {
    nodeStore.setPollInterval(siteConfig.poll_interval)
  })

  // If nodeStore detects 401 closed, mark unauthorized
  $effect(() => {
    if (nodeStore.closed) {
      meUnauthorized = true
    }
  })

  function setLayout(next: "grid" | "table") {
    visitorPrefs = { ...visitorPrefs, layout: next }
    savePref("layout", next)
  }

  function toggleLayout() {
    setLayout(effectiveLayout === "grid" ? "table" : "grid")
  }

  function setSort(next: SortKey) {
    sortKey = next
    visitorPrefs = { ...visitorPrefs, sort: next }
    savePref("sort", next)
  }

  async function fetchMe() {
    meError = ""
    try {
      const data = await api<Me>("/me")
      me = data
      if (!data.public_page && !data.authed) {
        meUnauthorized = true
      } else {
        meUnauthorized = false
      }
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) {
        meUnauthorized = true
      } else {
        meError = e instanceof Error ? e.message : "加载失败"
      }
    }
  }

  onMount(() => {
    void fetchMe()
    void loadConfig().then((cfg) => {
      siteConfig = cfg
      configLoaded = true
    })
    nodeStore.start()
  })

  onDestroy(() => {
    nodeStore.stop()
    router.destroy()
  })

  let sortedNodes = $derived(
    [...(nodeStore.nodes ?? [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id),
  )

  let activeNode = $derived(
    router.nodeId !== null ? sortedNodes.find((n) => n.id === router.nodeId) ?? null : null,
  )

  let siteName = $derived(me?.site_name?.trim() || "Monitor")

  let lastUpdateTitle = $derived.by(() => {
    const ts = nodeStore.lastUpdated
    if (!ts) return "等待更新"
    const hhmmss = new Date(ts).toLocaleTimeString("zh-CN", { hour12: false })
    return `最后更新 ${hhmmss}`
  })

  let groupLabel = $derived(
    selectedGroup === ALL_GROUP
      ? "全部节点"
      : selectedGroup === UNGROUPED
        ? "未分组"
        : String(selectedGroup),
  )

  // Document title per SPEC §6: `节点名 · site_name` (or `site_name` on home, fallback "Monitor")
  $effect(() => {
    if (typeof document !== "undefined") {
      document.title = activeNode ? `${activeNode.name} · ${siteName}` : siteName
    }
  })

  let historyDays = $derived(
    typeof me?.history_days === "number" && me.history_days >= 1 && me.history_days <= 365
      ? me.history_days
      : 7,
  )
</script>

{#if meUnauthorized}
  <div class="grid min-h-svh place-items-center px-4 py-12">
    <div
      data-testid="login-required"
      class="w-full max-w-sm rounded-[10px] border border-neutral-200 bg-white p-6 text-center"
    >
      <h1 class="text-base font-semibold text-neutral-900">需要登录后查看</h1>
      <p class="mt-2 text-[12px] text-neutral-500">
        当前状态页未公开，请登录管理员后台后访问。
      </p>
      <a
        href="/admin"
        class="mt-4 inline-flex items-center justify-center rounded-lg px-4 py-2 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
        style="background-color: var(--accent);"
      >
        前往管理后台 (/admin)
      </a>
    </div>
  </div>
{:else}
  <div class="flex min-h-svh flex-col">
    <!-- Top Header per SPEC-v1.1 §B -->
    <header class="sticky top-0 z-20 border-b border-neutral-200/80 bg-white/85 backdrop-blur">
      <div class="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-[16px] py-2.5">
        <!-- Left: /favicon.svg + site_name -->
        <a
          href="/"
          onclick={(e) => {
            e.preventDefault()
            router.navigate("/")
          }}
          class="inline-flex cursor-pointer items-center gap-2 text-[15px] font-bold tracking-tight text-neutral-900 transition-opacity hover:opacity-75"
        >
          <img src="/favicon.svg" alt="" class="h-5 w-5 shrink-0" />
          <span>{siteName}</span>
        </a>

        <!-- Right: conn-status + view toggle + admin-link (ONLY when me.authed === true) -->
        <div class="flex items-center gap-2">
          <div
            data-testid="conn-status"
            title={lastUpdateTitle}
            class="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[12px] font-medium text-neutral-600"
          >
            <span
              class="h-2 w-2 rounded-full"
              style="background-color: {nodeStore.connected ? 'var(--online)' : 'var(--warn)'};"
            ></span>
            <span>{nodeStore.connected ? "实时更新" : "轮询更新"}</span>
          </div>

          <button
            type="button"
            onclick={toggleLayout}
            title={effectiveLayout === "grid" ? "切换为列表视图" : "切换为卡片视图"}
            aria-label={effectiveLayout === "grid" ? "切换为列表视图" : "切换为卡片视图"}
            class="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[12px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            {#if effectiveLayout === "grid"}
              <span>列表</span>
            {:else}
              <span>卡片</span>
            {/if}
          </button>

          {#if me?.authed === true}
            <a
              href="/admin"
              data-testid="admin-link"
              title="管理后台"
              aria-label="管理后台"
              class="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
            >
              <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="8" cy="8" r="2.2" />
                <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" />
              </svg>
            </a>
          {/if}
        </div>
      </div>
    </header>

    <!-- Main Container (max-w 1440px, px 16px, compact spacing 12px) -->
    <main class="mx-auto w-full max-w-[1440px] flex-1 space-y-3 px-[16px] py-3.5">
      {#if siteConfig.announcement && siteConfig.announcement.trim()}
        <div
          data-testid="announcement"
          class="rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2.5 text-[12px] leading-relaxed text-neutral-700 whitespace-pre-line"
        >
          {siteConfig.announcement}
        </div>
      {/if}

      {#if (meError || nodeStore.error) && !nodeStore.nodes}
        <div
          role="alert"
          class="rounded-[10px] border border-red-200 bg-white p-6 text-center text-[12px] text-red-600"
        >
          <p>{nodeStore.error || meError}</p>
          <button
            type="button"
            onclick={() => {
              void fetchMe()
              nodeStore.resume()
            }}
            class="mt-3 cursor-pointer rounded-lg border border-neutral-200 px-3 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50"
          >
            重试
          </button>
        </div>
      {:else}
        {#if nodeStore.error}
          <div
            role="alert"
            class="rounded-[10px] border border-amber-200 bg-amber-50/70 px-3.5 py-2 text-[12px] text-amber-800"
          >
            {nodeStore.error}
          </div>
        {/if}

        {#if router.route.page === "node"}
          {#if !nodeStore.nodes}
            <div class="rounded-[10px] border border-neutral-200 bg-white py-14 text-center text-[12px] text-neutral-400">
              正在加载节点数据…
            </div>
          {:else if activeNode}
            <NodeDetail
              node={activeNode}
              orderedNodes={orderedNodes.length > 0 ? orderedNodes : sortedNodes}
              {groupLabel}
              {historyDays}
              showBilling={siteConfig.show_billing}
              expiryWarningDays={siteConfig.expiry_warning_days}
              accent={siteConfig.accent}
              onBack={() => router.navigate("/")}
              onSelectNode={(id) => router.navigate(id)}
            />
          {:else}
            <div class="rounded-[10px] border border-neutral-200 bg-white py-14 text-center text-[12px] text-neutral-500">
              <p>节点不存在或未公开</p>
              <button
                type="button"
                onclick={() => router.navigate("/")}
                class="mt-3 cursor-pointer underline"
              >
                返回节点列表
              </button>
            </div>
          {/if}
        {:else if !nodeStore.nodes}
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {#each [1, 2, 3, 4] as item (item)}
              <div class="h-48 animate-pulse rounded-[10px] border border-neutral-200 bg-white p-3"></div>
            {/each}
          </div>
        {:else}
          <Home
            nodes={sortedNodes}
            layout={effectiveLayout}
            cardSize={siteConfig.card_size}
            showSummary={siteConfig.show_summary}
            showMap={siteConfig.show_map}
            showSearch={siteConfig.show_search}
            showSort={siteConfig.show_sort}
            showBilling={siteConfig.show_billing}
            financeCurrency={siteConfig.finance_currency}
            expiryWarningDays={siteConfig.expiry_warning_days}
            bind:selectedGroup
            bind:sortKey
            bind:searchQuery
            onChangeLayout={setLayout}
            onChangeSort={setSort}
            onSelectNode={(id) => router.navigate(id)}
            onUpdateOrderedNodes={(list) => (orderedNodes = list)}
          />
        {/if}
      {/if}
    </main>

    <!-- Footer per SPEC-v1.1 §F & §G: pb >= 56px so visitor bubble never overlaps -->
    <footer class="border-t border-neutral-200/80 bg-white/80 pt-3.5 pb-[60px] text-[12px] text-neutral-500">
      <div class="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-[16px]">
        <div class="flex flex-wrap items-center gap-1.5">
          <a
            href="https://github.com/monitor-probe/monitor"
            target="_blank"
            rel="noopener noreferrer"
            class="font-medium text-neutral-600 transition-colors hover:text-neutral-900"
          >
            Powered by Monitor
          </a>
          <span class="text-neutral-300">·</span>
          <a
            href="https://github.com/dingding229/Monitor-DYS"
            target="_blank"
            rel="noopener noreferrer"
            class="font-medium text-neutral-600 transition-colors hover:text-neutral-900"
          >
            Theme by DYS
          </a>
        </div>

        {#if siteConfig.footer && siteConfig.footer.trim()}
          <div>
            {#if siteConfig.footer_url && /^https?:\/\//i.test(siteConfig.footer_url)}
              <a
                href={siteConfig.footer_url}
                target="_blank"
                rel="noopener noreferrer"
                class="text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
              >
                {siteConfig.footer}
              </a>
            {:else}
              <span>{siteConfig.footer}</span>
            {/if}
          </div>
        {/if}
      </div>
    </footer>

    <!-- Bottom Visitor Bubble: only mounted AFTER loadConfig() resolves -->
    {#if configLoaded && siteConfig.visitor_info_enabled}
      <VisitorBubble enabled={siteConfig.visitor_info_enabled} />
    {/if}
  </div>
{/if}
