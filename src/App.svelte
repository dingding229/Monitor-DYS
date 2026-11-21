<script lang="ts">
  import { onDestroy, onMount } from "svelte"
  import VisitorBubble from "@/components/VisitorBubble.svelte"
  import Home from "@/pages/Home.svelte"
  import { loadDetail } from "@/lib/detail"
  import { ALL_GROUP, UNGROUPED, ApiError, api, type GroupKey, type Me, type Node } from "@/lib/api"
  import { readSnapshot, saveSnapshot, clearSnapshot } from "@/lib/snapshot"
  import { createPingStore } from "@/lib/ping.svelte"
  import { resolveConfig, type ThemeConfig } from "@/lib/config"
  import { createNodeStore } from "@/lib/nodes.svelte"
  import { directory, readView, writeView, loadPrefs, savePref, type SortKey, type VisitorPrefs } from "@/lib/view-state"
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
  const ping = createPingStore()
  let logoFailed = $state(false)
  let me = $state<Me | null>(null)
  const nodeStore = createNodeStore({ autoStart: false, cachedNodes: readSnapshot(), onHttpSnapshot(nodes) {
    if (canCachePublic()) saveSnapshot(nodes)
  } })
  function canCachePublic() { return me?.public_page === true && me.authed === false && !nodeStore.closed }
  function saveLatest() {
    if (canCachePublic() && nodeStore.nodes && nodeStore.lastUpdated !== null) saveSnapshot(nodeStore.nodes)
  }
  let meError = $state<string>("")
  let meUnauthorized = $state<boolean>(false)
  let siteConfig = $state<ThemeConfig>(resolveConfig())
  let configLoaded = $state<boolean>(false)
  let visitorPrefs = $state<VisitorPrefs>(loadPrefs())
  const initialView = readView()
  let selectedGroup = $state<GroupKey>(initialView.group)
  let selectedCountry = $state<string | null>(initialView.country)
  let sortKey = $state<SortKey>(initialView.sort)
  let searchQuery = $state(initialView.query)
  let debounced = $state(initialView.query)
  $effect(() => { const text = searchQuery; const id = setTimeout(() => debounced = text, 120); return () => clearTimeout(id) })
  $effect(() => { if (router.route.page === 'home') writeView(selectedGroup, selectedCountry, searchQuery, sortKey) })
  function restoreView() {
    const v=readView(); selectedGroup=v.group; selectedCountry=v.country; searchQuery=v.query; debounced=v.query; sortKey=v.sort
  }

  // Effective layout per SPEC §5.13 & v1.2:
  // theme.json default < Hub config < visitor localStorage (only layout and sort)
  let effectiveLayout = $derived<"grid" | "table">(visitorPrefs.layout ?? siteConfig.layout)

  // Apply the validated site accent.
  $effect(() => {
    if (typeof document !== "undefined") {
      const accentColor = siteConfig.accent || "#10b981"
      document.documentElement.style.setProperty("--accent", accentColor)
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
      clearSnapshot()
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
      if (meUnauthorized || data.authed) clearSnapshot()
      else saveLatest() // HTTP may have completed before /me.
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) {
        clearSnapshot()
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
    window.addEventListener("pagehide", saveLatest)
    return () => window.removeEventListener("pagehide", saveLatest)
  })

  onDestroy(() => {
    ping.destroy()
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
  let filtered = $derived(directory(sortedNodes, selectedGroup, selectedCountry, siteConfig.show_search ? debounced : "", siteConfig.show_sort ? sortKey : "default"))
</script>
<svelte:window onpopstate={restoreView} />

{#if meUnauthorized || nodeStore.closed}
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
          {#if !logoFailed}<img src="/favicon.svg" alt="" width="22" height="22" class="shrink-0 rounded-full object-cover ring-1 ring-black/5" onerror={() => (logoFailed = true)} />{/if}
          <span class="truncate">{siteName}</span>
        </a>

        <!-- Right: conn-status + admin-link (ONLY when me.authed === true) -->
        <div class="flex items-center gap-2">
          <div
            data-testid="conn-status"
            title={lastUpdateTitle}
            class="inline-flex h-[28px] items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[12px] font-medium text-neutral-600"
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
              class="inline-flex h-[28px] items-center justify-center gap-1 px-2 rounded-lg border border-neutral-200 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
                <path d="M13.12 6.44L14.70 6.82L14.70 9.18L13.12 9.56L12.72 10.51L13.57 11.90L11.90 13.57L10.51 12.72L9.56 13.12L9.18 14.70L6.82 14.70L6.44 13.12L5.49 12.72L4.10 13.57L2.43 11.90L3.28 10.51L2.88 9.56L1.30 9.18L1.30 6.82L2.88 6.44L3.28 5.49L2.43 4.10L4.10 2.43L5.49 3.28L6.44 2.88L6.82 1.30L9.18 1.30L9.56 2.88L10.51 3.28L11.90 2.43L13.57 4.10L12.72 5.49Z" />
                <circle cx="8" cy="8" r="2.2" />
              </svg>
              <span class="hidden min-[640px]:inline">后台</span>
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
            class="rounded-[8px] border border-amber-200 bg-amber-50 px-3.5 py-2 text-[12px] text-amber-800"
          >
            {nodeStore.error}
          </div>
        {/if}

        {#if router.route.page === "node"}
          {#if !nodeStore.nodes || nodeStore.lastUpdated === null}
            <div class="rounded-[8px] border border-neutral-200 bg-white py-14 text-center text-[12px] text-neutral-400">
              正在加载节点数据…
            </div>
          {:else if activeNode && detailModule}
            {#await detailModule}<div class="panel p-6" data-testid="skeleton">加载详情…</div>
            {:then { default: NodeDetail }}
            <NodeDetail
              node={activeNode}
              showPing={configLoaded && siteConfig.show_ping}
              orderedNodes={filtered.list}
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
            {ping} showPing={configLoaded && siteConfig.show_ping && nodeStore.lastUpdated !== null}
            snapshotOnly={nodeStore.lastUpdated === null}
            loading={!nodeStore.nodes}
            {filtered}
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
          />
        {/if}
      {/if}
    </main>

    <footer use:observeFooter class="border-t border-neutral-200/80 bg-white py-[16px] text-[12px] text-neutral-500">
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
