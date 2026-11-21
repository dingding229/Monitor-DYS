<script lang="ts">
  import BrandIcon from "@/components/BrandIcon.svelte"
  import CountryFlag from "@/components/CountryFlag.svelte"
  import { regionName } from "@/lib/format"
  import { browserKey, osKey } from "@/lib/icons"
  import {
    dismissVisitorBubble,
    fetchVisitor,
    isVisitorBubbleDismissed,
    parseUA,
    type VisitorGeo,
  } from "@/lib/visitor"

  let { enabled = false }: { enabled?: boolean } = $props()

  let dismissed = $state<boolean>(false)
  let expanded = $state<boolean>(false)
  let geo = $state<VisitorGeo | null>(null)
  let fetched = $state<boolean>(false)
  let visitTime = $state<string>("")

  let uaInfo = $derived(
    parseUA(typeof navigator !== "undefined" ? navigator.userAgent : ""),
  )

  $effect(() => {
    if (!enabled) return
    if (isVisitorBubbleDismissed()) {
      dismissed = true
      return
    }
    if (!visitTime) {
      visitTime = new Date().toLocaleString("zh-CN", { hour12: false })
    }
    if (!fetched) {
      fetched = true
      void fetchVisitor().then((res) => {
        geo = res
      })
    }
  })

  // Per SPEC-v1.2 §4: Bubble shows Chinese region name from countryCode (city only in expanded panel)
  let bubbleRegionText = $derived.by(() => {
    if (!geo) return ""
    return regionName(geo.countryCode) || geo.country || ""
  })

  let deviceLabel = $derived(
    uaInfo.device === "mobile" ? "移动设备" : uaInfo.device === "tablet" ? "平板" : "桌面端",
  )

  function handleClose(e: MouseEvent) {
    e.stopPropagation()
    expanded = false
    dismissed = true
    dismissVisitorBubble()
  }
</script>

{#if enabled && !dismissed}
  <div class="fixed bottom-[12px] left-1/2 z-40 -translate-x-1/2 max-w-[92vw]">
    {#if expanded}
      <div
        data-testid="visitor-panel"
        class="mb-2 w-72 max-w-[90vw] rounded-[10px] border border-neutral-200 bg-white/98 p-3 text-[12px] shadow-md backdrop-blur"
      >
        <div class="flex items-center justify-between border-b border-neutral-100 pb-2">
          <span class="font-bold text-neutral-900">访客连接信息</span>
          <button
            type="button"
            onclick={() => (expanded = false)}
            aria-label="收起详情"
            class="cursor-pointer rounded px-1.5 py-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            收起
          </button>
        </div>

        <dl class="mt-2 space-y-1.5 text-[11.5px]">
          <div class="flex items-center justify-between gap-2">
            <dt class="text-neutral-400">设备 / 系统</dt>
            <dd class="inline-flex items-center gap-1.5 font-medium text-neutral-800">
              <BrandIcon key={osKey(uaInfo.os)} kind="os" size={13} title={uaInfo.os} />
              <span>{deviceLabel} · {uaInfo.os}</span>
            </dd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <dt class="text-neutral-400">浏览器版本</dt>
            <dd class="tnum inline-flex items-center gap-1.5 font-medium text-neutral-800">
              <BrandIcon key={browserKey(uaInfo.browser)} kind="browser" size={13} title={uaInfo.browser} />
              <span>{uaInfo.browser}{uaInfo.version ? ` ${uaInfo.version}` : ""}</span>
            </dd>
          </div>
          {#if geo}
            <div class="flex items-center justify-between gap-2">
              <dt class="text-neutral-400">出口 IP</dt>
              <dd class="tnum truncate font-medium text-neutral-800" title={geo.ip}>{geo.ip}</dd>
            </div>
            {#if bubbleRegionText || geo.city}
              <div class="flex items-center justify-between gap-2">
                <dt class="text-neutral-400">地区 / 城市</dt>
                <dd class="inline-flex items-center gap-1 font-medium text-neutral-800">
                  <CountryFlag code={geo.countryCode} />
                  <span>{[bubbleRegionText, geo.city].filter(Boolean).join(" · ")}</span>
                </dd>
              </div>
            {/if}
            {#if geo.isp}
              <div class="flex items-center justify-between gap-2">
                <dt class="shrink-0 text-neutral-400">运营商</dt>
                <dd class="truncate font-medium text-neutral-800" title={geo.isp}>{geo.isp}</dd>
              </div>
            {/if}
          {/if}
          <div class="flex items-center justify-between gap-2">
            <dt class="text-neutral-400">访问时间</dt>
            <dd class="tnum font-medium text-neutral-800">{visitTime}</dd>
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
      class="mx-auto inline-flex cursor-pointer items-center gap-2 rounded-full border border-neutral-200 bg-white/95 px-3 py-1 text-[11px] font-medium text-neutral-700 shadow-xs backdrop-blur transition-colors hover:border-neutral-300 sm:text-[12px]"
    >
      {#if geo && (geo.countryCode || bubbleRegionText)}
        <span class="inline-flex items-center gap-1.5">
          <CountryFlag code={geo.countryCode} />
          <span class="max-w-[110px] truncate">{bubbleRegionText}</span>
        </span>
        <span class="text-neutral-300">|</span>
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
        class="ml-0.5 inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
      >
        ×
      </button>
    </div>
  </div>
{/if}
