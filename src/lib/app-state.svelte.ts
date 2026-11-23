/**
 * Call `createApp({ initialMe, initialNodes, initialConfig })` once during root
 * component initialization. Start those reads before mounting; this model owns
 * their consumption, browser side effects and teardown for the session.
 *
 * State is exposed through reactive, getter-only properties. Read it in markup
 * or a `$derived` (do not destructure getters once). `home.directory` provides
 * tabs, grouped map input and filtered/sorted nodes. `orderedNodes` is the same
 * filtered order for the detail switcher; `activeNode` can still be a deep link
 * outside that list. `snapshotOnly` means no live/HTTP frame has arrived yet.
 * v3: `config.theme` selects the CSS preset. `history.fleet` stores fleet trends;
 * read `history.version` before `history.load(id)` in a reactive expression.
 * Pass `ping.peek` to the map for cache-only Ping lookups (no new cache cells).
 *
 * Use `setLayout`, `setSort`, `setGroup`, `setCountry`, `setQuery`, `selectNode`,
 * `back` (navigate home, not history.back), and `retry` to change session state.
 */
import { onDestroy, onMount } from "svelte"
import { ALL_GROUP, UNGROUPED, ApiError, api, type GroupKey, type Me, type Node } from "./api"
import { resolveConfig, type ThemeConfig } from "./config"
import { loadDetail } from "./detail"
import { createHomeView } from "./home-view.svelte"
import { createHistory } from "./history.svelte"
import { createNodeStore } from "./nodes.svelte"
import { createPingStore } from "./ping.svelte"
import { createRouter } from "./router.svelte"
import { readSnapshot, saveSnapshot, clearSnapshot } from "./snapshot"
import { readView, writeView, loadPrefs, savePref, type SortKey } from "./view-state"

export type AppStartup = {
  initialMe: Promise<Me>
  /** One-shot HTTP data. Its envelope is emptied after consumption; do not share it with other readers. */
  initialNodes: Promise<{ nodes: Node[] }>
  initialConfig: Promise<{ config: ThemeConfig; loaded: boolean }>
}

const connectionLabels = {
  connecting: { color: "var(--offline)", text: "连接中" },
  connected: { color: "var(--online)", text: "已连接" },
  live: { color: "var(--online)", text: "实时更新" },
  polling: { color: "var(--warn)", text: "轮询更新" },
} as const

export function createApp(initial: AppStartup) {
  const router = createRouter()
  const ping = createPingStore()
  const history = createHistory((): readonly Node[] => nodeStore.nodes ?? [])
  const nodeStore = createNodeStore({
    autoStart: false, cachedNodes: readSnapshot(), onRemoved: ping.forget, onFrame: history.sample,
    onHttpSnapshot(nodes) { if (canCachePublic()) saveSnapshot(nodes) },
  })
  const prefs = loadPrefs()
  let layoutPref = $state(prefs.layout)
  let me = $state.raw<Me | null>(null)
  let meError = $state("")
  let meUnauthorized = $state(false)
  let config = $state.raw(resolveConfig())
  let configLoaded = $state(false)
  let mounted = false

  const initialView = readView()
  let group = $state(initialView.group)
  let country = $state(initialView.country)
  let sort = $state(initialView.sort)
  let query = $state(initialView.query)
  let debounced = $state(initialView.query)
  const sortedNodes = $derived(
    [...(nodeStore.nodes ?? [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id),
  )
  const home = createHomeView(() => sortedNodes, () => ({
    group, country, query: config.show_search ? debounced : "", sort: config.show_sort ? sort : "default",
  }), ping.peek, () => config.expiry_warning_days)
  const activeNode = $derived.by(() => {
    const id = router.route.nodeId
    return id === null ? null : sortedNodes.find(n => n.id === id) ?? null
  })
  const detailModule = $derived(router.route.page === "node" ? loadDetail() : null)
  const siteName = $derived(me?.site_name?.trim() || "Monitor")
  const groupLabel = $derived(group === ALL_GROUP ? "全部节点" : group === UNGROUPED ? "未分组" : group)
  const historyDays = $derived(
    typeof me?.history_days === "number" && me.history_days >= 1 && me.history_days <= 365 ? me.history_days : 7,
  )
  const lastUpdateTitle = $derived.by(() => {
    const ts = nodeStore.lastUpdated
    return ts ? `最后更新 ${new Date(ts).toLocaleTimeString("zh-CN", { hour12: false })}` : "等待数据连接"
  })

  $effect(() => {
    const text = query
    const timer = setTimeout(() => debounced = text, 120)
    return () => clearTimeout(timer)
  })
  $effect(() => { if (router.route.page === "home") writeView(group, country, query, sort) })
  function restoreView() {
    const view = readView()
    group = view.group
    country = view.country
    query = debounced = view.query
    sort = view.sort
  }

  $effect(() => { document.title = activeNode ? `${activeNode.name} · ${siteName}` : siteName })
  $effect(() => { nodeStore.setPollInterval(config.poll_interval) })
  $effect(() => {
    if (nodeStore.closed) {
      meUnauthorized = true
      clearSnapshot()
    }
  })

  function canCachePublic() { return me?.public_page === true && me.authed === false && !nodeStore.closed }
  function saveLatest() {
    if (canCachePublic() && nodeStore.nodes && nodeStore.lastUpdated !== null) saveSnapshot(nodeStore.nodes)
  }

  async function fetchMe(request = api<Me>("/me")) {
    meError = ""
    try {
      const data = await request
      if (!mounted) return
      me = data
      meUnauthorized = !data.public_page && !data.authed
      if (meUnauthorized || data.authed) clearSnapshot()
      else saveLatest() // HTTP may have completed before /me.
    } catch (e: unknown) {
      if (!mounted) return
      if (e instanceof ApiError && e.status === 401) {
        clearSnapshot()
        meUnauthorized = true
      } else {
        meError = e instanceof Error ? e.message : "加载失败"
      }
    }
  }

  onMount(() => {
    mounted = true
    void fetchMe(initial.initialMe)
    void initial.initialConfig.then(({ config: next, loaded }) => {
      if (!mounted) return
      config = next
      configLoaded = loaded
      document.documentElement.dataset.theme = next.theme
      // First-paint hint only; the site config still decides the preset.
      try { localStorage.setItem("dys:theme", next.theme) } catch { /* storage unavailable */ }
    })
    // The root props can retain the settled Promise for the page lifetime.
    nodeStore.start(initial.initialNodes.then(payload => {
      if (!Array.isArray(payload?.nodes)) return payload
      const { nodes } = payload
      payload.nodes = []
      return { nodes }
    }))
    window.addEventListener("pagehide", saveLatest)
    window.addEventListener("popstate", restoreView)
  })
  onDestroy(() => {
    if (mounted) {
      window.removeEventListener("pagehide", saveLatest)
      window.removeEventListener("popstate", restoreView)
      mounted = false
    }
    ping.destroy()
    nodeStore.stop()
    router.destroy()
  })

  return {
    get route() { return router.route },
    get nodes() { return nodeStore.nodes },
    get loading() { return !nodeStore.nodes },
    get snapshotOnly() { return nodeStore.lastUpdated === null },
    get nodeError() { return nodeStore.error },
    get error() { return nodeStore.error || meError },
    get unauthorized() { return meUnauthorized || nodeStore.closed },
    get authed() { return me?.authed === true },
    get config(): Readonly<ThemeConfig> { return config },
    get configLoaded() { return configLoaded },
    get siteName() { return siteName },
    get layout() { return layoutPref ?? config.layout },
    get group() { return group },
    get country() { return country },
    get query() { return query },
    get sort() { return sort },
    get groupLabel() { return groupLabel },
    get historyDays() { return historyDays },
    get orderedNodes() { return home.directory.list },
    get activeNode() { return activeNode },
    get detailModule() { return detailModule },
    get connectionLabel() { return connectionLabels[nodeStore.connectionState] },
    get lastUpdateTitle() { return lastUpdateTitle },
    home, ping,
    history: { get fleet() { return history.fleet }, get version() { return history.version }, load: history.load },
    get pingEnabled() { return configLoaded && config.show_ping },
    setLayout(next: ThemeConfig["layout"]) {
      layoutPref = next
      savePref("layout", next)
    },
    setSort(next: SortKey) {
      sort = next
      savePref("sort", next)
    },
    setGroup(next: GroupKey) { group = next },
    setCountry(next: string | null) { country = next },
    setQuery(next: string) { query = next },
    selectNode(id: number) { router.navigate(id) },
    back() { router.navigate(null) },
    retry() {
      void fetchMe()
      nodeStore.resume()
    },
  }
}
