<script lang="ts">
  import BrandIcon from "@/components/BrandIcon.svelte"
  import CountryFlag from "@/components/CountryFlag.svelte"
  import { regionName } from "@/lib/format"
  import { browserKey, osKey } from "@/lib/icons"
  import { dismissVisitorBubble, fetchVisitor, isVisitorBubbleDismissed, parseUA, type VisitorGeo } from "@/lib/visitor"

  let { enabled = false, docked = false }: { enabled?: boolean; docked?: boolean } = $props()

  let dismissed = $state(false)
  let expanded = $state(false)
  let geo = $state<VisitorGeo | null>(null)
  let visitTime = $state("")

  let uaInfo = $derived(parseUA(typeof navigator !== "undefined" ? navigator.userAgent : ""))

  $effect(() => {
    if (!enabled) return
    if (isVisitorBubbleDismissed()) {
      dismissed = true
      return
    }
    visitTime = new Date().toLocaleString("zh-CN", { hour12: false })
    let active = true
    const locate = () => { if (active && !dismissed) void fetchVisitor().then((res) => { if (active) geo = res }) }
    const idle = typeof window.requestIdleCallback === "function"
    const id = idle ? window.requestIdleCallback(locate) : window.setTimeout(locate, 1500)
    return () => { active = false; if (idle) window.cancelIdleCallback(id); else window.clearTimeout(id) }
  })

  let bubbleRegionText = $derived(geo ? regionName(geo.countryCode) || geo.country || "" : "")
  let deviceLabel = $derived(uaInfo.device === "mobile" ? "移动设备" : uaInfo.device === "tablet" ? "平板" : "桌面端")

  function handleClose(e: MouseEvent) {
    e.stopPropagation()
    expanded = false
    dismissed = true
    dismissVisitorBubble()
  }
</script>

{#if enabled && !dismissed}
  <div class="visitor-anchor" class:docked>
    {#if expanded}
      <div data-testid="visitor-panel" class="visitor-popover panel w-72 max-w-[90vw] p-3 text-[12px]">
        <div class="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
          <span class="font-bold text-[var(--fg)]">访客连接信息</span>
          <button
            type="button"
            onclick={() => (expanded = false)}
            aria-label="收起详情"
            class="cursor-pointer rounded px-1.5 py-0.5 text-[var(--fg-subtle)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
          >
            收起
          </button>
        </div>

        <dl class="mt-2 space-y-1.5 text-[11.5px]">
          <div class="flex items-center justify-between gap-2">
            <dt class="text-[var(--fg-subtle)]">设备 / 系统</dt>
            <dd class="inline-flex items-center gap-1.5 font-medium text-[var(--fg)]">
              <BrandIcon key={osKey(uaInfo.os)} kind="os" size={13} title={uaInfo.os} />
              <span>{deviceLabel} · {uaInfo.os}</span>
            </dd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <dt class="text-[var(--fg-subtle)]">浏览器版本</dt>
            <dd class="tnum inline-flex items-center gap-1.5 font-medium text-[var(--fg)]">
              <BrandIcon key={browserKey(uaInfo.browser)} kind="browser" size={13} title={uaInfo.browser} />
              <span>{uaInfo.browser}{uaInfo.version ? ` ${uaInfo.version}` : ""}</span>
            </dd>
          </div>
          {#if geo}
            <div class="flex items-center justify-between gap-2">
              <dt class="text-[var(--fg-subtle)]">出口 IP</dt>
              <dd class="tnum truncate font-medium text-[var(--fg)]" title={geo.ip}>{geo.ip}</dd>
            </div>
            {#if bubbleRegionText || geo.city}
              <div class="flex items-center justify-between gap-2">
                <dt class="text-[var(--fg-subtle)]">地区 / 城市</dt>
                <dd class="inline-flex items-center gap-1 font-medium text-[var(--fg)]">
                  <CountryFlag code={geo.countryCode} />
                  <span>{[bubbleRegionText, geo.city].filter(Boolean).join(" · ")}</span>
                </dd>
              </div>
            {/if}
            {#if geo.isp}
              <div class="flex items-center justify-between gap-2">
                <dt class="shrink-0 text-[var(--fg-subtle)]">运营商</dt>
                <dd class="truncate font-medium text-[var(--fg)]" title={geo.isp}>{geo.isp}</dd>
              </div>
            {/if}
          {/if}
          <div class="flex items-center justify-between gap-2">
            <dt class="text-[var(--fg-subtle)]">访问时间</dt>
            <dd class="tnum font-medium text-[var(--fg)]">{visitTime}</dd>
          </div>
        </dl>
      </div>
    {/if}

    <div
      data-testid="visitor-bubble"
      role="button"
      tabindex="0"
      onclick={() => (expanded = !expanded)}
      onkeydown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), (expanded = !expanded))}
      class="mx-auto inline-flex h-[30px] cursor-pointer items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-[11px] font-medium text-[var(--fg-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg)] sm:text-[12px]"
    >
      {#if geo && (geo.countryCode || bubbleRegionText)}
        <span class="inline-flex items-center gap-1.5">
          <CountryFlag code={geo.countryCode} />
          <span class="max-w-[110px] truncate">{bubbleRegionText}</span>
        </span>
        <span class="text-[var(--border-strong)]">|</span>
      {/if}

      <span class="inline-flex items-center gap-1.5">
        <BrandIcon key={browserKey(uaInfo.browser)} kind="browser" size={13} title={uaInfo.browser} />
        <span>{uaInfo.browser}</span>
      </span>

      <button
        type="button"
        onclick={handleClose}
        title="关闭访客提示"
        aria-label="关闭访客提示"
        class="ml-0.5 inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-[var(--fg-subtle)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
      >
        ×
      </button>
    </div>
  </div>
{/if}
