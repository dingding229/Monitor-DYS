/**
 * v3 accepted-frame history. `createHistory(readNodes)` starts empty. The node
 * store calls `sample()` synchronously after each accepted HTTP or WS frame;
 * cached startup data and failed requests are not sampled.
 * `app.history` exposes `fleet` ({ tx, rx, cpu }, oldest first, at most 60),
 * `version` (increments each frame), and `load(id)` (at most 30 load1 values,
 * oldest first). In the template, read `version` before calling `load(id)`.
 */
import { num, type Node } from "./api"

const LOAD_POINTS = 30
const FLEET_POINTS = 60
const empty: readonly number[] = []

type Fleet = { tx: number[]; rx: number[]; cpu: number[] }
type LoadRing = { values: Float32Array; cursor: number; size: number; seen: number }

function append(series: number[], value: number): number[] {
  const next = series.slice(1 - FLEET_POINTS)
  next.push(value)
  return next
}

export function createHistory(readNodes: () => readonly Node[]) {
  const rings = new Map<number, LoadRing>()
  let fleet = $state.raw<Fleet>({ tx: [], rx: [], cpu: [] })
  let version = $state(0)

  function sample() {
    const frame = version + 1
    let tx = 0, rx = 0, cpu = 0, measured = 0
    for (const { id, online, metrics } of readNodes()) {
      const live = online ? metrics : null
      if (live) {
        tx += live.net_tx
        rx += live.net_rx
        cpu += live.cpu
        measured++
      }

      let ring = rings.get(id)
      const value = live?.load?.[0]
      if (num(value) && value >= 0 && Number.isFinite(Math.fround(value))) {
        if (!ring) rings.set(id, ring = { values: new Float32Array(LOAD_POINTS), cursor: 0, size: 0, seen: frame })
        ring.values[ring.cursor] = value
        ring.cursor = (ring.cursor + 1) % LOAD_POINTS
        if (ring.size < LOAD_POINTS) ring.size++
      }
      // Offline or missing metrics must not manufacture a zero load point.
      if (ring) ring.seen = frame
    }
    for (const [id, ring] of rings) if (ring.seen !== frame) rings.delete(id)
    fleet = { tx: append(fleet.tx, tx), rx: append(fleet.rx, rx), cpu: append(fleet.cpu, measured ? cpu / measured : 0) }
    version = frame
  }

  function load(id: number): readonly number[] {
    const ring = rings.get(id)
    if (!ring) return empty
    const { values, cursor, size } = ring
    const start = cursor - size + LOAD_POINTS
    const points = new Array<number>(size)
    for (let i = 0; i < size; i++) points[i] = values[(start + i) % LOAD_POINTS]
    return points
  }

  return { get fleet() { return fleet }, get version() { return version }, load, sample }
}
