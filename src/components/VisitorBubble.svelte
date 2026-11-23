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
    if (isVisitorBubbleDismissed()) { dismissed = true; return }
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
      <div data-testid="visitor-panel" class="visitor-popover panel vb-panel">
        <div class="vb-head">
          <span>访客连接信息</span>
          <button type="button" onclick={() => (expanded = false)} aria-label="收起详情" class="vb-min">收起</button>
        </div>

        <dl class="vb-dl">
          <div class="vb-row">
            <dt>设备 / 系统</dt>
            <dd><BrandIcon key={osKey(uaInfo.os)} kind="os" size={13} title={uaInfo.os} /><span>{deviceLabel} · {uaInfo.os}</span></dd>
          </div>
          <div class="vb-row">
            <dt>浏览器版本</dt>
            <dd class="tnum"><BrandIcon key={browserKey(uaInfo.browser)} kind="browser" size={13} title={uaInfo.browser} /><span>{uaInfo.browser}{uaInfo.version ? ` ${uaInfo.version}` : ""}</span></dd>
          </div>
          {#if geo}
            <div class="vb-row"><dt>出口 IP</dt><dd class="tnum vb-trunc" title={geo.ip}>{geo.ip}</dd></div>
            {#if bubbleRegionText || geo.city}
              <div class="vb-row"><dt>地区 / 城市</dt><dd><CountryFlag code={geo.countryCode} /><span>{[bubbleRegionText, geo.city].filter(Boolean).join(" · ")}</span></dd></div>
            {/if}
            {#if geo.isp}
              <div class="vb-row"><dt>运营商</dt><dd class="vb-trunc" title={geo.isp}>{geo.isp}</dd></div>
            {/if}
          {/if}
          <div class="vb-row"><dt>访问时间</dt><dd class="tnum">{visitTime}</dd></div>
        </dl>
      </div>
    {/if}

    <div
      data-testid="visitor-bubble"
      role="button"
      tabindex="0"
      onclick={() => (expanded = !expanded)}
      onkeydown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), (expanded = !expanded))}
      class="vb-pill"
    >
      {#if geo && (geo.countryCode || bubbleRegionText)}
        <span class="vb-item"><CountryFlag code={geo.countryCode} /><span class="vb-reg">{bubbleRegionText}</span></span>
        <span class="vb-sep">|</span>
      {/if}
      <span class="vb-item"><BrandIcon key={browserKey(uaInfo.browser)} kind="browser" size={13} title={uaInfo.browser} /><span>{uaInfo.browser}</span></span>
      <button type="button" onclick={handleClose} title="关闭访客提示" aria-label="关闭访客提示" class="vb-x">×</button>
    </div>
  </div>
{/if}

<style>
  .vb-panel { width: 288px; max-width: 90vw; padding: 12px; font-size: 12px; }
  .vb-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px; font-weight: 700; color: var(--fg); }
  .vb-min { cursor: pointer; border: 0; border-radius: 4px; background: transparent; padding: 2px 6px; font-size: 12px; color: var(--fg-subtle); }
  .vb-min:hover { background: var(--surface-hover); color: var(--fg); }
  .vb-dl { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; font-size: 11.5px; }
  .vb-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .vb-row dt { flex-shrink: 0; color: var(--fg-subtle); }
  .vb-row dd { display: inline-flex; min-width: 0; align-items: center; gap: 6px; font-weight: 500; color: var(--fg); }
  .vb-trunc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vb-pill { display: inline-flex; height: 30px; cursor: pointer; align-items: center; gap: 8px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface); padding: 0 12px; font-size: 12px; font-weight: 500; color: var(--fg-muted); }
  .vb-pill:hover { border-color: var(--border-strong); color: var(--fg); }
  .vb-item { display: inline-flex; align-items: center; gap: 6px; }
  .vb-reg { max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vb-sep { color: var(--border-strong); }
  .vb-x { display: inline-flex; height: 16px; width: 16px; cursor: pointer; align-items: center; justify-content: center; border: 0; border-radius: 999px; background: transparent; color: var(--fg-subtle); }
  .vb-x:hover { background: var(--surface-hover); color: var(--fg); }
</style>
