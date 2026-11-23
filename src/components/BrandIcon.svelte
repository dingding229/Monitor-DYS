<script lang="ts">
  import { getBrandIcon } from "@/lib/icons"

  let { key = "unknown", kind = "os", size = 14, title = "" }: {
    key?: string; kind?: "os" | "browser"; size?: number; title?: string
  } = $props()

  let d = $derived(getBrandIcon(key, kind))
</script>

{#if d.src}
  <span data-testid="brand-icon" data-key={key} role="img" aria-label={title || key} {title} class="brand-ico" style="width:{size}px;height:{size}px;background-color:{d.color};mask-image:url('{d.src}')"></span>
{:else}
  <svg data-testid="brand-icon" data-key={key} width={size} height={size} viewBox="0 0 24 24" fill={d.color} role="img" aria-label={title || key} class="brand-ico">
    {#each d.paths ?? [] as p (p)}<path d={p} />{/each}
  </svg>
{/if}
