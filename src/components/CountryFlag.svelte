<script module lang="ts">
  const FLAGS: Record<string, string> = Object.fromEntries(
    Object.entries(
      import.meta.glob<string>("/node_modules/country-flag-icons/3x2/*.svg", {
        query: "?url",
        import: "default",
        eager: true,
      }),
    ).map(([path, url]) => [path.match(/([\w-]+)\.svg$/)?.[1] ?? "", url]),
  )

</script>

<script lang="ts">
  let { code = "" }: { code?: string | null } = $props()

  let upper = $derived((code ?? "").trim().toUpperCase())
  let src = $derived(upper ? FLAGS[upper] : undefined)
</script>

{#if upper}
  {#if src}
    <img
      {src} width="21" height="14"
      alt={upper}
      title={upper}
      class="h-[14px] w-[21px] shrink-0 rounded-[2px] border border-neutral-200 object-cover"
    />
  {:else}
    <span
      class="inline-flex h-4 shrink-0 items-center rounded border border-neutral-200 px-1 text-[10px] font-medium text-neutral-500"
    >
      {upper}
    </span>
  {/if}
{/if}
