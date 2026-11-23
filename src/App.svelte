<script lang="ts">
  import { untrack } from "svelte"
  import Home from "@/pages/Home.svelte"
  import { createApp, type AppStartup } from "@/lib/app-state.svelte"

  let { initialMe, initialNodes, initialConfig }: AppStartup = $props()
  const app = createApp(untrack(() => ({ initialMe, initialNodes, initialConfig })))

  let logoFailed = $state(false)
  let footerVisible = $state(false)
  let visitorModule = $derived(app.configLoaded && app.config.visitor_info_enabled ? import("@/components/VisitorBubble.svelte") : null)

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
          onclick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
            e.preventDefault()
            app.back()
          }}
          class="brand-link"
        >
          {#if !logoFailed}
            <img src="/favicon.svg" alt="" width="22" height="22" class="brand-logo" onerror={() => (logoFailed = true)} />
          {/if}
          <span class="brand-name">{app.siteName}</span>
        </a>

        <div class="header-right">
          <div data-testid="conn-status" title={app.lastUpdateTitle} class="conn-pill">
            <i class="status-dot" style:background={app.connectionLabel.color}></i>
            <span>{app.connectionLabel.text}</span>
          </div>

          {#if app.authed}
            <a href="/admin" data-testid="admin-link" title="管理后台" aria-label="管理后台" class="btn" style="height:28px;padding:0 8px">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
                <path d="M13.12 6.44L14.70 6.82L14.70 9.18L13.12 9.56L12.72 10.51L13.57 11.90L11.90 13.57L10.51 12.72L9.56 13.12L9.18 14.70L6.82 14.70L6.44 13.12L5.49 12.72L4.10 13.57L2.43 11.90L3.28 10.51L2.88 9.56L1.30 9.18L1.30 6.82L2.88 6.44L3.28 5.49L2.43 4.10L4.10 2.43L5.49 3.28L6.44 2.88L6.82 1.30L9.18 1.30L9.56 2.88L10.51 3.28L11.90 2.43L13.57 4.10L12.72 5.49Z" />
                <circle cx="8" cy="8" r="2.2" />
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
            {#await app.detailModule}
              <div class="panel center-msg" data-testid="skeleton">加载详情…</div>
            {:then { default: NodeDetail }}
              <NodeDetail
                node={app.activeNode}
                showPing={app.pingEnabled}
                orderedNodes={app.orderedNodes}
                groupLabel={app.groupLabel}
                historyDays={app.historyDays}
                showBilling={app.config.show_billing}
                expiryWarningDays={app.config.expiry_warning_days}
                accent={app.config.accent}
                onBack={() => app.back()}
                onSelectNode={(id) => app.selectNode(id)}
              />
            {:catch}
              <p role="alert" class="panel alert-err">详情组件加载失败，请刷新重试。</p>
            {/await}
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

        {#if visitorModule}
          {#await visitorModule then { default: VisitorBubble }}
            <VisitorBubble enabled docked={footerVisible} />
          {/await}
        {/if}

        {#if app.config.footer?.trim()}
          <div>
            {#if app.config.footer_url && /^https?:\/\//i.test(app.config.footer_url)}
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
