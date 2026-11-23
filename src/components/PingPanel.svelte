<script lang="ts">
  import { probeTitle, type PingSummary } from "@/lib/ping.svelte"

  let { sample }: { sample?: PingSummary } = $props()

  function formatProbes(key: "latency" | "loss") {
    if (!sample) return "…"
    if (!sample.probes.length) return "—"
    return sample.probes
      .slice(0, 3)
      .map((p) => {
        const v = p[key]
        return v == null ? "—" : key === "loss" ? String(Number(v.toFixed(1))) : String(Math.round(v))
      })
      .join("·")
  }

  function barClass(value: number | null | undefined, loss: boolean) {
    if (value == null) return ""
    return value <= (loss ? 0 : 99) ? "g" : value <= (loss ? 5 : 200) ? "w" : "d"
  }
</script>

<div
  class="nc-ping"
  class:pending={!sample?.probes.length}
  data-testid="node-ping"
  data-latency={sample?.latency ?? ""}
  data-loss={sample?.loss ?? ""}
  title={probeTitle(sample)}
>
  <div class="ping-caption">延迟 ms{" "}<b class="nc-pv tnum">{formatProbes("latency")}</b></div>
  <div class="ping-caption nc-pr">丢包 %{" "}<b class="nc-pv tnum">{formatProbes("loss")}</b></div>
  <div data-testid="ping-bars" class="nc-pbars" aria-hidden="true">
    {#each Array(12) as _, i}
      <i class={barClass(sample?.buckets[i - 12 + (sample?.buckets.length ?? 0)]?.latency, false)}></i>
    {/each}
  </div>
  <div data-testid="ping-bars" class="nc-pbars nc-pr" aria-hidden="true">
    {#each Array(12) as _, i}
      <i class={barClass(sample?.buckets[i - 12 + (sample?.buckets.length ?? 0)]?.loss, true)}></i>
    {/each}
  </div>
</div>

<style>
  .nc-ping {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid var(--border-subtle);
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.95fr);
    gap: 5px 4px;
  }
  .ping-caption { display: flex; align-items: baseline; justify-content: space-between; gap: 3px; min-width: 0; font-size: 11px; color: var(--fg-subtle); }
  .nc-pv {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: -0.02em;
    color: var(--fg-muted);
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pending .nc-pv { color: var(--fg-subtle); }
  .nc-pr { border-left: 1px solid var(--border-subtle); padding-left: 5px; }
  .nc-pbars {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 2px;
  }
  .nc-pbars i { display: block; height: 4px; border-radius: 1px; background: var(--bar-track); }
  .nc-pbars i.g { background: var(--online); }
  .nc-pbars i.w { background: var(--warn); }
  .nc-pbars i.d { background: var(--danger); }
</style>
