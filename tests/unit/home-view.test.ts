import { describe, expect, it } from "vitest"
import { aggregateCountries, summarizeNodes } from "../../src/lib/home-view.svelte"
import { metricFixture, nodeFixture } from "../fixtures/nodes"

const n = nodeFixture
const m = metricFixture
const ping = (values: Record<number, { latency: number | null; loss: number | null }>) => (id: number) => values[id]

describe("summarizeNodes", () => {
  it("aggregates traffic, online cores, peak CPU, availability and ordered statuses", () => {
    const nodes = [
      n({ id: 1, name: "A", country: " jp ", cpu_cores: 2, metrics: m({ cpu: 30, net_tx: 10, net_rx: 20 }), month_tx: 4, month_rx: 5, total_tx: 6, total_rx: 7, day_tx: 2, day_rx: 3 }),
      n({ id: 2, name: "B", country: "JP", online: false, cpu_cores: 99, metrics: m({ cpu: 99 }), month_tx: 1, month_rx: 2, total_tx: 3, total_rx: 4, day_tx: undefined, day_rx: undefined }),
      n({ id: 3, name: "C", country: "us", cpu_cores: 4, metrics: m({ cpu: 90, net_tx: 30, net_rx: 40 }), month_tx: 0, month_rx: 0, total_tx: 0, total_rx: 0, day_tx: 0, day_rx: 0 }),
    ]
    expect(summarizeNodes(nodes)).toMatchObject({ total: 3, online: 2, offline: 1, warn: 1, countries: new Set(["JP", "US"]), tx: 40, rx: 60, month_tx: 5, month_rx: 7, total_tx: 9, total_rx: 11, day_tx: 2, day_rx: 3, cores: 6, peakCpu: { id: 3, name: "C", value: 90 }, uptimeRatio: 2 / 3, statusStrip: ["online", "offline", "warn"] })
    expect(summarizeNodes([])).toMatchObject({ total: 0, uptimeRatio: 0, cores: null, peakCpu: null, day_tx: null, day_rx: null, statusStrip: [] })
    expect(summarizeNodes([n({ cpu_cores: undefined, metrics: null })])).toMatchObject({ cores: null, peakCpu: null })
  })
  it.each([
    ["CPU", m({ cpu: 90 })], ["memory", m({ mem_total: 100, mem_used: 90 })], ["disk", m({ disk_total: 100, disk_used: 90 })],
  ])("warns at the 90%% %s boundary", (_name, metrics) => {
    expect(summarizeNodes([n({ metrics })])).toMatchObject({ warn: 1, statusStrip: ["warn"] })
    expect(summarizeNodes([n({ online: false, metrics })])).toMatchObject({ warn: 0, statusStrip: ["offline"] })
  })
  it("handles Ping thresholds, missing data and values below thresholds", () => {
    const nodes = [1, 2, 3, 4].map(id => n({ id }))
    expect(summarizeNodes(nodes, ping({ 1: { latency: 200, loss: 0 }, 2: { latency: null, loss: 5 }, 3: { latency: 199, loss: 4.9 } }))).toMatchObject({ warn: 2, statusStrip: ["warn", "warn", "online", "online"] })
  })
  it("uses expiry boundaries and configurable warning days, including offline nodes", () => {
    const nodes = [-2, 0, 1, 3, 4, null].map((expires_in, id) => n({ id, expires_in, online: id !== 0 }))
    expect(summarizeNodes(nodes, undefined, 3)).toMatchObject({ expired: 2, expiring: 2 })
    expect(summarizeNodes(nodes, undefined, 1)).toMatchObject({ expired: 2, expiring: 1 })
  })
})

describe("aggregateCountries", () => {
  it("aggregates online latencies and warnings, including unlocated nodes in totals", () => {
    const nodes = [n({ id: 1, country: " jp ", metrics: m({ net_tx: 10, net_rx: 20 }) }), n({ id: 2, country: "JP", online: false }), n({ id: 3, country: "us" }), n({ id: 4, country: "" }), n({ id: 5, country: "US" })]
    const result = aggregateCountries(nodes, ping({ 1: { latency: 100, loss: 0 }, 2: { latency: 900, loss: 99 }, 3: { latency: 200, loss: 0 }, 4: { latency: 300, loss: 0 }, 5: { latency: null, loss: 0 } }))
    expect(result.countries).toEqual([
      { code: "JP", total: 2, online: 1, tx: 10, rx: 20, latency: 100, warn: true },
      { code: "US", total: 2, online: 2, tx: 600, rx: 1200, latency: 200, warn: true },
    ])
    expect(result.totals).toEqual({ regions: 2, onlineRate: 4 / 5, avgLatency: 200 })
    expect(aggregateCountries([])).toEqual({ countries: [], totals: { regions: 0, onlineRate: 0, avgLatency: null } })
    expect(aggregateCountries([n({ country: "DE" })]).countries[0]).toMatchObject({ latency: null, warn: false })
  })
})
