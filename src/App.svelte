<script lang="ts">
  import { onDestroy, onMount } from "svelte"
  import VisitorBubble from "@/components/VisitorBubble.svelte"
  import Home from "@/pages/Home.svelte"
  import { loadDetail } from "@/lib/detail"
  import { ALL_GROUP, UNGROUPED, ApiError, api, type GroupKey, type Me, type Node } from "@/lib/api"
  import { withAlpha } from "@/lib/color"
  import { resolveConfig, type ThemeConfig } from "@/lib/config"
  import { createNodeStore } from "@/lib/nodes.svelte"
  import { loadPrefs, savePref, type SortKey, type VisitorPrefs } from "@/lib/prefs"
  import { createRouter } from "@/lib/router.svelte"

  let { initialMe, initialNodes, initialConfig }: {
    initialMe: Promise<Me>; initialNodes: Promise<{ nodes: Node[] }>; initialConfig: Promise<{ config: ThemeConfig; loaded: boolean }>
  } = $props()
  let footerVisible = $state(false)
  function observeFooter(el: HTMLElement) {
    const observer = new IntersectionObserver(([entry]) => { footerVisible = entry.isIntersecting })
    observer.observe(el)
    return { destroy: () => observer.disconnect() }
  }
  const router = createRouter()
  const nodeStore = createNodeStore({ autoStart: false })

  let me = $state<Me | null>(null)
  let meError = $state<string>("")
  let meUnauthorized = $state<boolean>(false)
  let siteConfig = $state<ThemeConfig>(resolveConfig())
  let configLoaded = $state<boolean>(false)
  let visitorPrefs = $state<VisitorPrefs>(loadPrefs())
  let selectedGroup = $state<GroupKey>(ALL_GROUP)
  let selectedCountry = $state<string | null>(null)
  let sortKey = $state<SortKey>(loadPrefs().sort ?? "default")
  let searchQuery = $state<string>("")
  let orderedNodes = $state<Node[]>([])

  // Effective layout per SPEC §5.13 & v1.2:
  // theme.json default < Hub config < visitor localStorage (only layout and sort)
  let effectiveLayout = $derived<"grid" | "table">(visitorPrefs.layout ?? siteConfig.layout)

  // Apply `--accent` and `--accent-glow` CSS variables
  $effect(() => {
    if (typeof document !== "undefined") {
      const accentColor = siteConfig.accent || "#10b981"
      document.documentElement.style.setProperty("--accent", accentColor)
      document.documentElement.style.setProperty("--accent-glow", withAlpha(accentColor, 0.16))
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

  function setSort(next: SortKey) {
    sortKey = next
    visitorPrefs = { ...visitorPrefs, sort: next }
    savePref("sort", next)
  }

  async function fetchMe(request = api<Me>("/me")) {
    meError = ""
    try {
      const data = await request
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
    void fetchMe(initialMe)
    void initialConfig.then(({ config, loaded }) => {
      siteConfig = config
      configLoaded = loaded
    })
    nodeStore.start(initialNodes)
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
    if (!ts) return "等待数据连接"
    const hhmmss = new Date(ts).toLocaleTimeString("zh-CN", { hour12: false })
    return `最后更新 ${hhmmss}`
  })

  const statuses = {
    connecting: { color: "var(--offline)", text: "连接中" },
    connected: { color: "var(--online)", text: "已连接" },
    live: { color: "var(--online)", text: "实时更新" },
    polling: { color: "var(--warn)", text: "轮询更新" },
  }
  let connState = $derived(statuses[nodeStore.connectionState])
  let detailModule = $derived(router.route.page === "node" ? loadDetail() : null)

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
      class="w-full max-w-sm rounded-[8px] border border-neutral-200 bg-white p-6 text-center"
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
    <!-- Top Header per SPEC-v1.1 §B & SPEC-v1.2 §5 (view toggle button removed from top bar) -->
    <header class="site-header sticky top-0 z-20 border-b">
      <div class="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-[16px] py-2.5">
        <!-- Left: /favicon.svg + site_name -->
        <a
          href="/"
          onclick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
            e.preventDefault()
            router.navigate("/")
          }}
          class="inline-flex cursor-pointer items-center gap-2 text-[15px] font-bold tracking-tight text-neutral-900 transition-opacity hover:opacity-75"
        >
          <img src="/favicon.svg" alt="" class="h-5 w-5 shrink-0" />
          <span class="truncate">{siteName}</span>
          {#if nodeStore.nodes}<span class="online-pill hidden sm:inline-flex">{sortedNodes.filter(n => n.online).length} 在线</span>
          {:else}<span class="bone hidden h-4 w-12 sm:inline-block"></span>{/if}
        </a>

        <!-- Right: conn-status + admin-link (ONLY when me.authed === true) -->
        <div class="flex items-center gap-2">
          <div
            data-testid="conn-status"
            title={lastUpdateTitle}
            class="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[12px] font-medium text-neutral-600"
          >
            <span
              class="h-2 w-2 rounded-full"
              style="background-color: {connState.color};"
            ></span>
            <span>{connState.text}</span>
          </div>

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
    <main class="mx-auto w-full max-w-[1440px] flex-1 space-y-3 px-[16px] pt-3.5 pb-[16px]">
      {#if siteConfig.announcement && siteConfig.announcement.trim()}
        <div
          data-testid="announcement"
          class="rounded-[8px] border border-neutral-200 bg-white px-3.5 py-2.5 text-[12px] leading-relaxed text-neutral-700 whitespace-pre-line"
        >
          {siteConfig.announcement}
        </div>
      {/if}

      {#if (meError || nodeStore.error) && !nodeStore.nodes}
        <div
          role="alert"
          class="rounded-[8px] border border-red-200 bg-white p-6 text-center text-[12px] text-red-600"
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
            class="rounded-[8px] border border-amber-200 bg-amber-50/70 px-3.5 py-2 text-[12px] text-amber-800"
          >
            {nodeStore.error}
          </div>
        {/if}

        {#if router.route.page === "node"}
          {#if !nodeStore.nodes}
            <div class="rounded-[8px] border border-neutral-200 bg-white py-14 text-center text-[12px] text-neutral-400">
              正在加载节点数据…
            </div>
          {:else if activeNode && detailModule}
            {#await detailModule}<div class="glass-panel p-6" data-testid="skeleton">加载详情…</div>
            {:then { default: NodeDetail }}
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
            {:catch}<p role="alert">详情组件加载失败，请刷新重试。</p>{/await}
          {:else}
            <div class="rounded-[8px] border border-neutral-200 bg-white py-14 text-center text-[12px] text-neutral-500">
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
        {:else}
          <Home
            loading={!nodeStore.nodes}
            nodes={sortedNodes}
            accent={siteConfig.accent}
            layout={effectiveLayout}
            cardSize={siteConfig.card_size}
            showSummary={siteConfig.show_summary}
            showMap={siteConfig.show_map}
            showSearch={siteConfig.show_search}
            showSort={siteConfig.show_sort}
            showBilling={siteConfig.show_billing}
            expiryWarningDays={siteConfig.expiry_warning_days}
            bind:selectedGroup
            bind:selectedCountry
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

    <footer use:observeFooter class="border-t border-neutral-200/80 bg-white/80 py-[16px] text-[12px] text-neutral-500">
      <div class="footer-inner mx-auto max-w-[1440px] px-[16px]">
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

        {#if configLoaded && siteConfig.visitor_info_enabled}
          <VisitorBubble enabled docked={footerVisible} />
        {/if}
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

  </div>
{/if}
