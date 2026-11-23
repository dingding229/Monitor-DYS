import { describe, expect, it } from "vitest"
import { aggregateCountries, summarizeNodes } from "../../src/lib/home-view.svelte"
import { metricFixture, nodeFixture } from "../fixtures/nodes"

const nodes = [
  nodeFixture({ id: 1, name: "A", country: " jp ", online: true, metrics: metricFixture({ net_tx: 10, net_rx: 20, month_tx: 100 }), month_tx: 4, month_rx: 5, total_tx: 6, total_rx: 7, day_tx: 2, day_rx: 3 }),
  nodeFixture({ id: 2, name: "B", country: "JP", online: false, metrics: metricFixture({ net_tx: 999, net_rx: 999 }), month_tx: 1, month_rx: 2, total_tx: 3, total_rx: 4, day_tx: undefined, day_rx: undefined }),
  nodeFixture({ id: 3, name: "C", country: "us", online: true, metrics: metricFixture({ net_tx: 30, net_rx: 40 }), month_tx: 0, month_rx: 0, total_tx: 0, total_rx: 0, day_tx: 0, day_rx: 0 }),
  nodeFixture({ id: 4, name: "D", country: "", online: false, metrics: null, month_tx: 0, month_rx: 0, total_tx: 0, total_rx: 0, day_tx: undefined, day_rx: undefined }),
]

describe("summarizeNodes", () => {
  it("counts all nodes and countries, adds online speeds, and sums historical traffic from all nodes", () => {
    expect(summarizeNodes(nodes)).toEqual({ total: 4, online: 2, offline: 2, countries: new Set(["JP", "US"]), tx: 40, rx: 60, month_tx: 5, month_rx: 7, total_tx: 9, total_rx: 11, day_tx: 2, day_rx: 3 })
  })
  it("keeps unknown daily data null, handles empty inputs, and falls back to metric totals", () => {
    expect(summarizeNodes([])).toMatchObject({ total: 0, online: 0, offline: 0, day_tx: null, day_rx: null })
    const n = nodeFixture({ month_tx: undefined, month_rx: undefined, total_tx: undefined, total_rx: undefined, day_tx: undefined, day_rx: undefined, metrics: metricFixture({ month_tx: 123, month_rx: 45, total_tx: 67, total_rx: 89 }) })
    expect(summarizeNodes([n])).toMatchObject({ month_tx: 123, month_rx: 45, total_tx: 67, total_rx: 89, day_tx: null, day_rx: null })
  })
})

describe("aggregateCountries", () => {
  it("normalizes country codes and includes unlocated nodes only in global totals", () => {
    expect(aggregateCountries(nodes)).toEqual({ total: 4, online: 2, offline: 2, countries: [
      { code: "JP", total: 2, online: 1, tx: 10, rx: 20, nodeNames: ["A", "B"] },
      { code: "US", total: 1, online: 1, tx: 30, rx: 40, nodeNames: ["C"] },
    ] })
  })
  it("sorts equal counts by code and handles empty input", () => {
    expect(aggregateCountries([])).toEqual({ total: 0, online: 0, offline: 0, countries: [] })
    expect(aggregateCountries([nodeFixture({ country: "US" }), nodeFixture({ country: "de" })]).countries.map(c => c.code)).toEqual(["DE", "US"])
  })
})
