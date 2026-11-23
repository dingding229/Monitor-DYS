<script lang="ts">
  import { getBrandIcon } from "@/lib/icons"

  let {
    key = "unknown",
    kind = "os",
    size = 14,
    title = "",
  }: {
    key?: string
    kind?: "os" | "browser"
    size?: number
    title?: string
  } = $props()

  let iconDef = $derived(getBrandIcon(key, kind))
</script>

{#if iconDef.src}
  <span data-testid="brand-icon" data-key={key} role="img" aria-label={title || key} {title}
    class="inline-block shrink-0" style:width="{size}px" style:height="{size}px" style:background-color={iconDef.color}
    style:mask-image={`url("${iconDef.src}")`} style:mask-size="contain" style:mask-repeat="no-repeat"></span>
{:else}
<svg
  data-testid="brand-icon"
  data-key={key}
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill={iconDef.color}
  role="img"
  aria-label={title || key}
  class="inline-block shrink-0 align-middle"
>
  {#each iconDef.paths ?? [] as d (d)}
    <path {d} />
  {/each}
</svg>
{/if}
