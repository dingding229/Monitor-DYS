<script lang="ts">
  import { hasFlag } from "country-flag-icons"
  let { code }: { code?: string | null } = $props()
  let upper = $derived((code ?? "").trim().toUpperCase())
  const base = import.meta.env.DEV ? "/node_modules/country-flag-icons/3x2/" : "/assets/flags/"
</script>
{#if upper && hasFlag(upper)}
  <img src="{base}{upper}.svg" width="21" height="14" alt={upper} title={upper} class="h-[14px] w-[21px] shrink-0 rounded-[2px] border border-[var(--border)] object-cover" />
{:else if upper}
  <span class="rounded border border-[var(--border)] px-1 text-[10px] text-[var(--fg-subtle)]">{upper}</span>
{/if}
