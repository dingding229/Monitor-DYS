<script lang="ts">
  import { onDestroy, onMount } from "svelte"
  import Home from "@/pages/Home.svelte"
  import NodeDetail from "@/pages/NodeDetail.svelte"
  import { ALL_GROUP, ApiError, api, type GroupKey, type Me } from "@/lib/api"
  import { loadConfig, resolveConfig, type ThemeConfig } from "@/lib/config"
  import { createNodeStore } from "@/lib/nodes.svelte"
  import { loadPrefs, savePref, type VisitorPrefs } from "@/lib/prefs"
  import { createRouter } from "@/lib/router.svelte"

  const router = createRouter()
  const nodeStore = createNodeStore({ autoStart: false })

  let me = $state<Me | null>(null)
  let meError = $state<string>("")
  let meUnauthorized = $state<boolean>(false)
  let siteConfig = $state<ThemeConfig>(resolveConfig())
  let visitorPrefs = $state<VisitorPrefs>(loadPrefs())
  let systemDark = $state<boolean>(
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false,
  )
  let selectedGroup = $state<GroupKey>(ALL_GROUP)

  // Effective layout & color scheme per SPEC §5.13:
  // theme.json default < Hub config < visitor localStorage (only layout, color_scheme, sort)
  let effectiveLayout = $derived<"grid" | "table">(visitorPrefs.layout ?? siteConfig.layout)
  let effectiveScheme = $derived<"auto" | "light" | "dark">(visitorPrefs.color_scheme ?? siteConfig.color_scheme)
  let isDark = $derived(effectiveScheme === "dark" ? true : effectiveScheme === "light" ? false : systemDark)

  // Apply dark mode class `html.dark` and `--accent` CSS variable
  $effect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", isDark)
      document.documentElement.style.setProperty("--accent", siteConfig.accent || "#2563eb")
    }
  })

  // Sync poll_interval from siteConfig to nodeStore
  $effect(() => {
    nodeStore.setPollInterval(siteConfig.poll_interval)
  })

  // If nodeStore detects 401 closed, re-check /me or mark unauthorized
  $effect(() => {
    if (nodeStore.closed) {
      meUnauthorized = true
    }
  })

  function toggleLayout() {
    const next = effectiveLayout === "grid" ? "table" : "grid"
    visitorPrefs = { ...visitorPrefs, layout: next }
    savePref("layout", next)
  }

  function toggleColorScheme() {
    const next = isDark ? "light" : "dark"
    visitorPrefs = { ...visitorPrefs, color_scheme: next }
    savePref("color_scheme", next)
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

  let mediaQuery: MediaQueryList | null = null
  const onMediaChange = (e: MediaQueryListEvent) => {
    systemDark = e.matches
  }

  onMount(() => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      systemDark = mediaQuery.matches
      mediaQuery.addEventListener("change", onMediaChange)
    }

    void fetchMe()
    void loadConfig().then((cfg) => {
      siteConfig = cfg
    })
    nodeStore.start()
  })

  onDestroy(() => {
    mediaQuery?.removeEventListener("change", onMediaChange)
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
      class="w-full max-w-sm rounded-[12px] border border-neutral-200 bg-white p-6 text-center dark:border-neutral-800 dark:bg-neutral-900"
    >
      <h1 class="text-base font-semibold text-neutral-900 dark:text-neutral-100">需要登录后查看</h1>
      <p class="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        当前状态页未公开，请登录管理员后台后访问。
      </p>
      <a
        href="/admin"
        class="mt-4 inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
        style="background-color: var(--accent);"
      >
        前往管理后台 (/admin)
      </a>
    </div>
  </div>
{:else}
  <div class="flex min-h-svh flex-col">
    <!-- Top Header -->
    <header class="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90">
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          onclick={() => router.navigate("/")}
          class="cursor-pointer text-base font-semibold tracking-tight text-neutral-900 transition-opacity hover:opacity-75 dark:text-neutral-100"
        >
          {siteName}
        </button>

        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={toggleLayout}
            title={effectiveLayout === "grid" ? "切换为列表视图" : "切换为卡片视图"}
            aria-label={effectiveLayout === "grid" ? "切换为列表视图" : "切换为卡片视图"}
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            {#if effectiveLayout === "grid"}
              <span>列表</span>
            {:else}
              <span>卡片</span>
            {/if}
          </button>

          <button
            type="button"
            onclick={toggleColorScheme}
            title={isDark ? "切换为浅色模式" : "切换为深色模式"}
            aria-label={isDark ? "切换为浅色模式" : "切换为深色模式"}
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            {#if isDark}
              <span>浅色</span>
            {:else}
              <span>深色</span>
            {/if}
          </button>

          <a
            href="/admin"
            class="inline-flex items-center rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            {me?.authed ? "后台" : "登录"}
          </a>
        </div>
      </div>
    </header>

    <!-- Main Container -->
    <main class="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-5 sm:px-6">
      {#if siteConfig.announcement && siteConfig.announcement.trim()}
        <div
          data-testid="announcement"
          class="rounded-[12px] border border-neutral-200 bg-white px-4 py-3 text-xs leading-relaxed text-neutral-700 whitespace-pre-line dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
        >
          {siteConfig.announcement}
        </div>
      {/if}

      {#if (meError || nodeStore.error) && !nodeStore.nodes}
        <div
          role="alert"
          class="rounded-[12px] border border-red-200 bg-white p-6 text-center text-xs text-red-600 dark:border-red-900/50 dark:bg-neutral-900 dark:text-red-400"
        >
          <p>{nodeStore.error || meError}</p>
          <button
            type="button"
            onclick={() => {
              void fetchMe()
              nodeStore.resume()
            }}
            class="mt-3 cursor-pointer rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300"
          >
            重试
          </button>
        </div>
      {:else}
        {#if nodeStore.error}
          <div
            role="alert"
            class="rounded-[12px] border border-amber-200 bg-amber-50/60 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
          >
            {nodeStore.error}
          </div>
        {/if}

        {#if router.route.page === "node"}
          {#if !nodeStore.nodes}
            <div class="rounded-[12px] border border-neutral-200 bg-white py-16 text-center text-xs text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
              正在加载节点数据…
            </div>
          {:else if activeNode}
            <NodeDetail
              node={activeNode}
              {historyDays}
              showBilling={siteConfig.show_billing}
              accent={siteConfig.accent}
              onBack={() => router.navigate("/")}
            />
          {:else}
            <div class="rounded-[12px] border border-neutral-200 bg-white py-16 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
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
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {#each [1, 2, 3, 4] as item (item)}
              <div class="h-56 animate-pulse rounded-[12px] border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"></div>
            {/each}
          </div>
        {:else}
          <Home
            nodes={sortedNodes}
            layout={effectiveLayout}
            showSummary={siteConfig.show_summary}
            showBilling={siteConfig.show_billing}
            bind:selectedGroup
            onSelectNode={(id) => router.navigate(id)}
          />
        {/if}
      {/if}
    </main>

    {#if siteConfig.footer && siteConfig.footer.trim()}
      <footer class="border-t border-neutral-200 bg-white py-4 text-center text-xs text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-500">
        <div class="mx-auto max-w-7xl px-4 sm:px-6">
          {siteConfig.footer}
        </div>
      </footer>
    {/if}
  </div>
{/if}
