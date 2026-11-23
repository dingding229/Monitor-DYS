import { describe, expect, it } from "vitest"
import { createHistory } from "../../src/lib/history.svelte"
import { metricFixture, nodeFixture } from "../fixtures/nodes"

describe("accepted frame history", () => {
  it("bounds fleet at 60, wraps node loads at 30 in chronological order, and increments version per frame", () => {
    let nodes = [nodeFixture({ id: 1 })]
    const history = createHistory(() => nodes)
    expect(history.fleet).toEqual({ tx: [], rx: [], cpu: [] })
    expect(history.version).toBe(0)
    for (let i = 0; i < 75; i++) {
      nodes = [nodeFixture({ id: 1, metrics: metricFixture({ net_tx: i, net_rx: i * 2, cpu: i, load: [i, 0, 0] }) })]
      const prev = history.fleet
      history.sample()
      expect(history.version).toBe(i + 1)
      expect(history.fleet).not.toBe(prev)
      expect(history.fleet.tx.length).toBeLessThanOrEqual(60)
      expect(history.fleet.rx.length).toBeLessThanOrEqual(60)
      expect(history.fleet.cpu.length).toBeLessThanOrEqual(60)
      expect(history.load(1).length).toBeLessThanOrEqual(30)
    }
    expect(history.fleet.tx).toEqual(Array.from({ length: 60 }, (_, i) => i + 15))
    expect(history.fleet.rx).toEqual(Array.from({ length: 60 }, (_, i) => (i + 15) * 2))
    expect(history.fleet.cpu).toEqual(Array.from({ length: 60 }, (_, i) => i + 15))
    expect(history.load(1)).toEqual(Array.from({ length: 30 }, (_, i) => i + 45))
    nodes = []
    history.sample()
    expect(history.load(1)).toEqual([])
    expect(history.version).toBe(76)
    nodes = [nodeFixture({ id: 1, metrics: metricFixture({ load: [7, 0, 0] }) })]
    history.sample()
    expect(history.load(1)).toEqual([7])
  })
  it("ignores offline data for fleet and preserves the load ring without inserting zeros", () => {
    let nodes = [nodeFixture({ metrics: metricFixture({ cpu: 20, net_tx: 10, net_rx: 30, load: [3, 0, 0] }) }), nodeFixture({ id: 2, metrics: metricFixture({ cpu: 40, net_tx: 20, net_rx: 50, load: [5, 0, 0] }) })]
    const history = createHistory(() => nodes)
    history.sample()
    expect(history.fleet).toEqual({ tx: [30], rx: [80], cpu: [30] })
    nodes = [nodeFixture({ online: false })]
    history.sample()
    expect(history.load(1)).toEqual([3])
    expect(history.load(2)).toEqual([])
    expect(history.fleet).toEqual({ tx: [30, 0], rx: [80, 0], cpu: [30, 0] })
  })
})
