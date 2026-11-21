import { describe, expect, it } from "vitest"
import { lossText, summarizePing } from "../../src/lib/ping.svelte"

const probes = { 9: "东京探测", 2: "法兰克福探测" }
const step = 60
const metrics: never[] = []

function point(task_id: number, ts: number, latency: number | null, loss?: number) {
  return { task_id, ts, latency, ...(loss === undefined ? {} : { loss }) }
}

// Include old replies and a trailing timeout so a simple average of all rows is incorrect.
const history = [
  point(9, 60, 94, 0), point(9, 120, 21, 10), point(9, 180, null, 0),
  point(2, 60, 87, 0), point(2, 120, 34, 20),
]

describe("summarizePing", () => {
  it("rounds the average of the latest non-null reply from each probe", () => {
    const summary = summarizePing({ step, metrics, ping: history, probes })
    expect(summary?.latency).toBe(28)
    expect(summary?.probes).toHaveLength(2)
    expect(summary?.probes).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "东京探测", latency: 21 }),
      expect.objectContaining({ name: "法兰克福探测", latency: 34 }),
    ]))
  })

  it("uses the server's loss object instead of recomputing from samples", () => {
    const summary = summarizePing({ step, metrics, ping: history, probes, loss: { 9: 1.5, 2: 5.5 } })
    expect(summary?.loss).toBe(3.5)
    expect(summary?.probes).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "东京探测", loss: 1.5 }),
      expect.objectContaining({ name: "法兰克福探测", loss: 5.5 }),
    ]))
  })

  it("averages the individual ping rows when the loss object is absent", () => {
    // The probes have different sample counts: (0 + 10 + 0 + 0 + 20) / 5 = 6.
    expect(summarizePing({ step, metrics, ping: history, probes })?.loss).toBe(6)
  })

  it("returns an empty summary for an empty ping array", () => {
    expect(summarizePing({ step, metrics, ping: [], probes: {} })).toEqual({ latency: null, loss: null, probes: [] })
  })

  it("returns the same empty summary for invalid input", () => {
    expect(summarizePing({ ping: null })).toEqual({ latency: null, loss: null, probes: [] })
  })

  it("keeps loss data when every latency is null", () => {
    const summary = summarizePing({ step, metrics, ping: [point(9, 60, null, 100), point(2, 60, null, 100)], probes })
    expect(summary).toMatchObject({ latency: null, loss: 100 })
    expect(summary?.probes.map(({ latency }) => latency)).toEqual([null, null])
  })
})

describe("lossText", () => {
  it.each<[number | null | undefined, string]>([
    [0, "0%"], [5, "5%"], [100, "100%"], [45.6, "45.6%"],
    [undefined, "…"], [null, "—"],
  ])("formats %s as %s", (loss, expected) => {
    expect(lossText(loss)).toBe(expected)
  })
})
