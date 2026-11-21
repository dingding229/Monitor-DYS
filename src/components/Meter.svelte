<script lang="ts">
  import { percentNum } from "@/lib/format"

  let {
    label,
    icon = "",
    used,
    total,
    pct = null,
    foot = "",
    empty = "—",
  }: {
    label: string
    icon?: "cpu" | "mem" | "disk" | "traffic" | ""
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
      : `${computedPct < 10 && computedPct > 0 ? computedPct.toFixed(1) : computedPct.toFixed(1)}%`,
  )

  // Per SPEC-v1.1 §C.3: >= 90% red, >= 80% amber, otherwise accent
  let barColor = $derived(
    computedPct !== null && computedPct >= 90
      ? "var(--danger)"
      : computedPct !== null && computedPct >= 80
        ? "var(--warn)"
        : "var(--accent)",
  )
</script>

<div class="min-w-0">
  <div class="flex items-center justify-between gap-1 truncate text-[12px]">
    <span class="inline-flex min-w-0 items-center gap-1 truncate text-neutral-500">
      {#if icon === "cpu"}
        <svg class="h-3.5 w-3.5 shrink-0 text-sky-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" />
          <rect x="6" y="6" width="4" height="4" rx="0.5" />
          <path d="M6 1.5v2M10 1.5v2M6 12.5v2M10 12.5v2M1.5 6h2M1.5 10h2M12.5 6h2M12.5 10h2" />
        </svg>
      {:else if icon === "mem"}
        <svg class="h-3.5 w-3.5 shrink-0 text-emerald-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="4.5" width="12" height="7" rx="1.5" />
          <path d="M5 7v2M8 7v2M11 7v2M4 11.5v1.5M12 11.5v1.5" />
        </svg>
      {:else if icon === "disk"}
        <svg class="h-3.5 w-3.5 shrink-0 text-amber-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="3.5" width="12" height="9" rx="2" />
          <path d="M2 8.5h12" />
          <circle cx="11.5" cy="10.5" r="0.75" fill="currentColor" />
        </svg>
      {:else if icon === "traffic"}
        <svg class="h-3.5 w-3.5 shrink-0 text-purple-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M5 12V4M5 4L2.5 6.5M5 4l2.5 2.5M11 4v8m0 0l-2.5-2.5M11 12l2.5-2.5" />
        </svg>
      {/if}
      <span class="truncate">{label}</span>
    </span>
    <span class="tnum shrink-0 font-semibold text-neutral-800">{pctText}</span>
  </div>
  <div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
    <div
      class="h-full rounded-full transition-[width] duration-300"
      style="width: {barWidth}%; background-color: {barColor};"
    ></div>
  </div>
  {#if foot}
    <div class="tnum mt-1 truncate text-[11px] text-neutral-500" title={foot}>{foot}</div>
  {/if}
</div>
