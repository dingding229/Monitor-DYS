<script lang="ts">
  import { untrack } from "svelte"
  import VisitorBubble from "@/components/VisitorBubble.svelte"
  import Home from "@/pages/Home.svelte"
  import { createApp, type AppStartup } from "@/lib/app-state.svelte"

  const props: AppStartup = $props()
  const app = untrack(() => createApp(props))
  const siteConfig = $derived(app.config)
  const detailModule = $derived(app.detailModule)
  let logoFailed = $state(false)
  let footerVisible = $state(false)
  function observeFooter(el: HTMLElement) {
    const observer = new IntersectionObserver(([entry]) => { footerVisible = entry.isIntersecting })
    observer.observe(el)
    return { destroy: () => observer.disconnect() }
  }
</script>

{#if app.unauthorized}
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
            app.back()
          }}
          class="inline-flex cursor-pointer items-center gap-2 text-[15px] font-bold tracking-tight text-neutral-900 transition-opacity hover:opacity-75"
        >
          {#if !logoFailed}<img src="/favicon.svg" alt="" width="22" height="22" class="shrink-0 rounded-full object-cover ring-1 ring-black/5" onerror={() => (logoFailed = true)} />{/if}
          <span class="truncate">{app.siteName}</span>
        </a>

        <!-- Right: conn-status + admin-link (ONLY when me.authed === true) -->
        <div class="flex items-center gap-2">
          <div
            data-testid="conn-status"
            title={app.lastUpdateTitle}
            class="inline-flex h-[28px] items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[12px] font-medium text-neutral-600"
          >
            <span
              class="h-2 w-2 rounded-full"
              style="background-color: {app.connectionLabel.color};"
            ></span>
            <span>{app.connectionLabel.text}</span>
          </div>

          {#if app.authed}
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

      {#if app.error && app.loading}
        <div
          role="alert"
          class="rounded-[8px] border border-red-200 bg-white p-6 text-center text-[12px] text-red-600"
        >
          <p>{app.error}</p>
          <button
            type="button"
            onclick={app.retry}
            class="mt-3 cursor-pointer rounded-lg border border-neutral-200 px-3 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50"
          >
            重试
          </button>
        </div>
      {:else}
        {#if app.nodeError}
          <div
            role="alert"
            class="rounded-[8px] border border-amber-200 bg-amber-50 px-3.5 py-2 text-[12px] text-amber-800"
          >
            {app.nodeError}
          </div>
        {/if}

        {#if app.route.page === "node"}
          {#if app.loading || app.snapshotOnly}
            <div class="rounded-[8px] border border-neutral-200 bg-white py-14 text-center text-[12px] text-neutral-400">
              正在加载节点数据…
            </div>
          {:else if app.activeNode && detailModule}
            {#await detailModule}<div class="panel p-6" data-testid="skeleton">加载详情…</div>
            {:then { default: NodeDetail }}
            <NodeDetail
              node={app.activeNode}
              showPing={app.pingEnabled}
              orderedNodes={app.orderedNodes}
              groupLabel={app.groupLabel}
              historyDays={app.historyDays}
              showBilling={siteConfig.show_billing}
              expiryWarningDays={siteConfig.expiry_warning_days}
              accent={siteConfig.accent}
              onBack={app.back}
              onSelectNode={app.selectNode}
            />
            {:catch}<p role="alert">详情组件加载失败，请刷新重试。</p>{/await}
          {:else}
            <div class="rounded-[8px] border border-neutral-200 bg-white py-14 text-center text-[12px] text-neutral-500">
              <p>节点不存在或未公开</p>
              <button
                type="button"
                onclick={app.back}
                class="mt-3 cursor-pointer underline"
              >
                返回节点列表
              </button>
            </div>
          {/if}
        {:else}
          <Home
            ping={app.ping} showPing={app.pingEnabled && !app.snapshotOnly}
            snapshotOnly={app.snapshotOnly}
            loading={app.loading}
            filtered={app.home.directory}
            accent={siteConfig.accent}
            layout={app.layout}
            cardSize={siteConfig.card_size}
            showSummary={siteConfig.show_summary}
            showMap={siteConfig.show_map}
            showSearch={siteConfig.show_search}
            showSort={siteConfig.show_sort}
            showBilling={siteConfig.show_billing}
            expiryWarningDays={siteConfig.expiry_warning_days}
            bind:selectedGroup={() => app.group, app.setGroup}
            bind:selectedCountry={() => app.country, app.setCountry}
            sortKey={app.sort}
            bind:searchQuery={() => app.query, app.setQuery}
            onChangeLayout={app.setLayout}
            onChangeSort={app.setSort}
            onSelectNode={app.selectNode}
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

        {#if app.configLoaded && siteConfig.visitor_info_enabled}
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
