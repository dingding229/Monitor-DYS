<script lang="ts">
  import { percentNum } from "@/lib/format"

  let {
    label,
    used,
    total,
    pct = null,
    foot = "",
    empty = "—",
  }: {
    label: string
    used?: number
    total?: number
    pct?: number | null
    foot?: string
    empty?: string
  } = $props()

  let computedPct = $derived(
    pct !== null && pct !== undefined
      ? pct
      : typeof used === "number" && typeof total === "number" && total > 0
        ? percentNum(used, total)
        : null,
  )

  let barWidth = $derived(computedPct === null ? 0 : Math.min(100, Math.max(0, computedPct)))
  let pctText = $derived(
    computedPct === null
      ? empty
      : `${computedPct < 10 && computedPct > 0 ? computedPct.toFixed(1) : Math.round(computedPct)}%`,
  )
</script>

<div class="min-w-0">
  <div class="flex items-baseline justify-between gap-2 text-xs">
    <span class="truncate text-neutral-500 dark:text-neutral-400">{label}</span>
    <span class="tnum font-medium text-neutral-800 dark:text-neutral-200">{pctText}</span>
  </div>
  <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
    <div
      class="h-full rounded-full transition-[width] duration-300"
      style="width: {barWidth}%; background-color: var(--accent);"
    ></div>
  </div>
  {#if foot}
    <div class="tnum mt-1 truncate text-[11px] text-neutral-500 dark:text-neutral-400">{foot}</div>
  {/if}
</div>
