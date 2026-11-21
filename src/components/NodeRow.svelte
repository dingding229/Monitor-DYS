<script lang="ts">
  import BrandIcon from './BrandIcon.svelte'
  import CountryFlag from './CountryFlag.svelte'
  import {freezeNode} from '@/lib/viewport.svelte'
  import { latencyText,lossText,latencyColor,lossColor,probeTitle,type PingStore } from '@/lib/ping.svelte'
  import {percentNum,expiry,offlineFor,priceShort,regionName,monthUsage,bytes,FOREVER,pair,speed} from '@/lib/format'
  import {prefetchDetail} from '@/lib/detail'
  import {osKey} from '@/lib/icons'
  import type {Node} from '@/lib/api'
  let {node:incoming,defer,ping,showPing,snapshotOnly,showBilling,expiryWarningDays,onSelect}: {
    node:Node;defer:boolean;ping:PingStore;showPing:boolean;snapshotOnly:boolean;showBilling:boolean;expiryWarningDays:number;onSelect:(id:number)=>void
  }=$props()
  const view=freezeNode(()=>incoming,()=>defer), observe=view.observe, watchPing=(el:Element,id:number)=>ping.observe(el,id)
  let n=$derived(view.node), m=$derived(n.metrics), exp=$derived(expiry(n,Date.now(),expiryWarningDays)), sample=$derived(ping.get(n.id))
  let latency=$derived(n.online?sample?.latency:null), loss=$derived(n.online?sample?.loss:null)
  let state=$derived(snapshotOnly?'状态待确认':n.online?'在线':`离线 ${offlineFor(n)??''}`)
  function link(e:MouseEvent){e.stopPropagation(); if(e.metaKey||e.altKey||e.ctrlKey||e.shiftKey||e.button!==0)return; e.preventDefault();onSelect(n.id)}
</script>
<tr data-testid="node-row" use:observe use:watchPing={showPing && n.online ? n.id : 0} onclick={()=>onSelect(n.id)} class="node-row cursor-pointer whitespace-nowrap hover:bg-neutral-50">
  <td><a href="/node/{n.id}" onfocus={prefetchDetail} onpointerenter={prefetchDetail} onclick={link} class="font-semibold hover:underline">{n.name}</a></td>
  {#if view.painted}
    <td><span class="inline-flex items-center gap-1.5"><CountryFlag code={n.country}/>{regionName(n.country)||'—'}<BrandIcon key={osKey(n.os)} title={n.os||'未知系统'}/></span></td>
    {#if n._corrupt || (n.online && !m)}<td colspan="3" data-testid={n._corrupt?'status-unavailable':'status-waiting'}>{n._corrupt?'不可用':'等待数据'}</td>
    {:else}{#each [m?.cpu,m && percentNum(m.mem_used,m.mem_total),m && percentNum(m.disk_used,m.disk_total)] as pct}
      <td>{pct==null?'—':`${pct.toFixed(1)}%`}<div class="mt-1 h-1 w-20 rounded-full bg-neutral-100"><div class="h-full rounded-full" style:width="{Math.min(100,pct??0)}%" style:background={(pct??0)>=90?'var(--danger)':(pct??0)>=80?'var(--warn)':'var(--accent)'}></div></div></td>
    {/each}{/if}
    <td class="text-emerald-600">{speed(m?.net_tx??0)}</td><td class="text-sky-600">{speed(m?.net_rx??0)}</td>
    {#if showPing}<td data-testid="node-ping" data-latency={latency??''} data-loss={loss??''} class={latencyColor(latency)} title={probeTitle(sample)}>{latencyText(latency)}</td>
      <td class={lossColor(loss)} title={probeTitle(sample)}>{lossText(loss)}</td>{/if}
    <td>{n.traffic_limit>0?pair(monthUsage(n),n.traffic_limit):`${bytes(monthUsage(n))} / ${FOREVER}`}</td>
    <td><div class:text-amber-600={exp.level==='soon'} class:text-red-600={exp.level==='expired'}>{exp.text||'长期'}</div>{#if showBilling && n.price>0}<small>{priceShort(n.price,n.currency||'CNY',n.billing_cycle)}</small>{/if}</td>
    <td><i class="mr-1 inline-block h-2 w-2 rounded-full" style:background={!snapshotOnly&&n.online?'var(--online)':'var(--offline)'}></i>{state}</td>
  {:else}<td colspan={showPing?11:9} style="height:44px"></td>{/if}
</tr>
<style>td{padding:8px 10px;font-variant-numeric:tabular-nums}</style>
