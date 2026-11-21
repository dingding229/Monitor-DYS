import { untrack } from 'svelte'
import type { Node } from './api'

const watchers = new Map<Element, (visible:boolean)=>void>()
let observer: IntersectionObserver | undefined
/** Offscreen components unsubscribe from the incoming row, retaining their last displayed value. */
export function freezeNode(read:()=>Node, defer:()=>boolean) {
  let last = untrack(read), visible = $state(false), painted = $state(!untrack(defer))
  return {
    get node() { return visible ? (last=read()) : last }, get painted() { return painted },
    observe(el:Element) {
      observer ??= new IntersectionObserver(entries=>{
        for(const e of entries) watchers.get(e.target)?.(e.isIntersecting)
      },{rootMargin:'300px'})
      watchers.set(el,yes=>{visible=yes; if(yes) painted=true}); observer.observe(el)
      return {destroy(){watchers.delete(el); observer?.unobserve(el); if(!watchers.size){observer?.disconnect();observer=undefined}}}
    }
  }
}
export function batchLimit(length:()=>number) {
  let limit=$state(40)
  $effect(()=>{
    const total=length(); limit=40
    if(total<=60) return
    let count=40, cancel:()=>void
    function enqueue(){
      const append=()=>{count+=60;limit=count;if(count<total) enqueue()}
      if(typeof requestIdleCallback==='function'){const id=requestIdleCallback(append,{timeout:150});cancel=()=>cancelIdleCallback(id)}
      else {const id=setTimeout(append,16);cancel=()=>clearTimeout(id)}
    }
    enqueue();return ()=>cancel()
  })
  return ()=>length()<=60?length():Math.min(length(),limit)
}
