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
  {#if title}
    <title>{title}</title>
  {/if}
  {#each iconDef.paths as d (d)}
    <path {d} />
  {/each}
</svg>
