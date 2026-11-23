<script lang="ts">
  import { untrack, type Component } from "svelte"
  import Home from "@/pages/Home.svelte"
  import { createApp, type AppStartup } from "@/lib/app-state.svelte"

  let { initialMe, initialNodes, initialConfig }: AppStartup = $props()
  const app = createApp(untrack(() => ({ initialMe, initialNodes, initialConfig })))

  let logoFailed = $state(false)
  let footerVisible = $state(false)
  let DetailComp = $state.raw<Component<any> | null>(null)
  let detailErr = $state(false)
  let VisitorComp = $state.raw<Component<any> | null>(null)

  $effect(() => {
    const mod = app.detailModule
    if (!mod || DetailComp) return
    detailErr = false
    void mod.then((m) => (DetailComp = m.default), () => (detailErr = true))
  })
  $effect(() => { if (app.configLoaded && app.config.visitor_info_enabled && !VisitorComp) void import("@/components/VisitorBubble.svelte").then((m) => (VisitorComp = m.default), () => {}) })

  function observeFooter(el: HTMLElement) {
    const observer = new IntersectionObserver(([entry]) => { footerVisible = entry.isIntersecting })
    observer.observe(el)
    return { destroy: () => observer.disconnect() }
  }
</script>

{#if app.unauthorized}
  <div class="login-wrap">
    <div data-testid="login-required" class="panel login-card">
      <h1 style="font-size:15px;font-weight:700">需要登录后查看</h1>
      <p class="fg-muted" style="margin-top:8px;font-size:12px">当前状态页未公开，请登录管理员后台后访问。</p>
      <a href="/admin" class="btn btn-primary" style="margin-top:16px;padding:0 16px">前往管理后台 (/admin)</a>
    </div>
  </div>
{:else}
  <div class="app-shell">
    <header class="site-header">
      <div class="wrap header-row">
        <a
          href="/"
          onclick={(e) => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); app.back() } }}
          class="brand-link"
        >
          {#if !logoFailed}
            <img src="/favicon.svg" alt="" width="24" height="24" class="brand-logo" onerror={() => (logoFailed = true)} />
          {/if}
          <span class="brand-name">{app.siteName}</span>
        </a>

        <div class="header-right">
          <div data-testid="conn-status" title={app.lastUpdateTitle} class="conn-pill {app.connectionLabel.text === '轮询更新' ? 'warn' : app.connectionLabel.text === '连接中' ? 'off' : ''}">
            <i class="status-dot" style="background:{app.connectionLabel.color}"></i>
            <span>{app.connectionLabel.text}</span>
          </div>

          {#if app.authed}
            <a href="/admin" data-testid="admin-link" title="管理后台" aria-label="管理后台" class="btn" style="height:28px;padding:0 9px">
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="8" cy="8" r="2.5" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" />
              </svg>
              <span class="admin-text">后台</span>
            </a>
          {/if}
        </div>
      </div>
    </header>

    <main class="wrap app-main">
      {#if app.config.announcement?.trim()}
        <div data-testid="announcement" class="panel announcement">{app.config.announcement}</div>
      {/if}

      {#if app.error && !app.nodes}
        <div role="alert" class="panel alert-err">
          <p>{app.error}</p>
          <button type="button" onclick={() => app.retry()} class="btn" style="margin-top:12px">重试</button>
        </div>
      {:else}
        {#if app.nodeError}
          <div role="alert" class="panel alert-warn">{app.nodeError}</div>
        {/if}

        {#if app.route.page === "node"}
          {#if !app.nodes || app.snapshotOnly}
            <div class="panel center-msg">正在加载节点数据…</div>
          {:else if app.activeNode && app.detailModule}
            {#if detailErr}
              <p role="alert" class="panel alert-err">详情组件加载失败，请刷新重试。</p>
            {:else if DetailComp}
              <DetailComp node={app.activeNode} {app} />
            {:else}
              <div class="panel center-msg" data-testid="skeleton">加载详情…</div>
            {/if}
          {:else}
            <div class="panel center-msg fg-muted">
              <p>节点不存在或未公开</p>
              <button type="button" onclick={() => app.back()} class="btn" style="margin-top:12px">返回节点列表</button>
            </div>
          {/if}
        {:else}
          <Home {app} />
        {/if}
      {/if}
    </main>

    <footer use:observeFooter class="site-footer">
      <div class="footer-inner wrap">
        <div class="footer-links">
          <a href="https://github.com/monitor-probe/monitor" target="_blank" rel="noopener noreferrer">Powered by Monitor</a>
          <span aria-hidden="true">·</span>
          <a href="https://github.com/dingding229/Monitor-DYS" target="_blank" rel="noopener noreferrer">Theme by DYS</a>
        </div>

        {#if VisitorComp}
          <VisitorComp enabled docked={footerVisible} />
        {/if}

        {#if app.config.footer?.trim()}
          <div class="footer-right">
            {#if app.config.footer_url}
              <a href={app.config.footer_url} target="_blank" rel="noopener noreferrer" class="fg-muted">{app.config.footer}</a>
            {:else}
              <span>{app.config.footer}</span>
            {/if}
          </div>
        {/if}
      </div>
    </footer>
  </div>
{/if}
