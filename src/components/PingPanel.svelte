<script lang="ts">
  import { probeTitle, type PingSummary } from '@/lib/ping.svelte'
  let {sample}: {sample?:PingSummary} = $props()
  const fields = [{key:'latency',label:'延迟',unit:'ms'}, {key:'loss',label:'丢包',unit:'%'}] as const
  function tint(value:number|null|undefined, loss:boolean) {
    return value == null ? '#e5e7eb' : value <= (loss ? 0 : 99) ? '#86d5a8' : value <= (loss ? 5 : 200) ? '#e6b76b' : '#e88989'
  }
</script>
<div class="ping-panel" class:pending={!sample?.probes.length} data-testid="node-ping" data-latency={sample?.latency ?? ''} data-loss={sample?.loss ?? ''} title={probeTitle(sample)}>
  {#each fields as {key,label,unit}}
    <div><div class="ping-caption"><span>{label}<small>{unit}</small></span>{" "}<b class="tnum">
      {#if !sample}…{:else if !sample.probes.length}—{:else}{#each sample.probes.slice(0,3) as probe, i}{@const v=probe[key]}{#if i}<i class="separator">·</i>{/if}{v == null ? '—' : key === 'loss' ? Number(v.toFixed(1)) : Math.round(v)}{/each}{/if}
    </b></div>
      <div data-testid="ping-bars" class="ping-bars" aria-hidden="true">{#each Array(12) as _,i}<i style:background={tint(sample?.buckets[i-12+(sample?.buckets.length ?? 0)]?.[key],key==='loss')}></i>{/each}</div>
    </div>
  {/each}
</div>
<style>
  .ping-panel {display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,1fr);border-top:1px solid var(--border);margin-top:8px;padding-top:7px;font-size:12px;color:#737373}
  .ping-panel>div {min-width:0;padding-right:3px}.ping-panel>div+div {border-left:1px solid var(--border);padding:0 0 0 3px}
  .ping-caption {display:flex;align-items:baseline;justify-content:space-between;gap:1px}
  .ping-caption small {font:10px Arial,sans-serif;color:#929994;margin-left:2px}
  .ping-caption b {font-size:12px;font-weight:500;font-variant-numeric:tabular-nums;color:#404040;overflow:hidden;text-overflow:ellipsis}
  .separator {font-style:normal;margin-inline:.25px}.pending b {color:#737373}
  .ping-bars {display:grid;grid-template-columns:repeat(12,1fr);gap:2px;margin-top:4px}.ping-bars i {height:4px;border-radius:1px}
</style>
