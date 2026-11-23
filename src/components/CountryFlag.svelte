<script lang="ts">
  let { code }: { code?: string | null } = $props()
  let failed = $state("")
  let upper = $derived((code ?? "").trim().toUpperCase())
  const base = import.meta.env.DEV ? "/node_modules/country-flag-icons/3x2/" : "/assets/flags/"
</script>
{#if upper && /^[A-Z]{2}$/.test(upper) && failed !== upper}
  <img src="{base}{upper}.svg" width="21" height="14" alt={upper} title={upper} onerror={() => (failed = upper)} class="flag" />
{:else if upper}
  <span class="flag-fb">{upper}</span>
{/if}
