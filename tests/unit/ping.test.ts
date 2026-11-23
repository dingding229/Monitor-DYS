import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createPingStore, lossText } from "../../src/lib/ping.svelte"

let stores: ReturnType<typeof createPingStore>[] = []
beforeEach(() => { vi.useFakeTimers(); vi.spyOn(document, "hidden", "get").mockReturnValue(false) })
afterEach(() => { stores.forEach(store => store.destroy()); stores = []; vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function readSummary(body: unknown) {
  let notify!: IntersectionObserverCallback
  class Observer {
    constructor(callback: IntersectionObserverCallback) { notify = callback }
    observe() {} unobserve() {} disconnect() {}
  }
  vi.stubGlobal("IntersectionObserver", Observer)
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)))
  const store = createPingStore()
  stores.push(store)
  const element = document.createElement("div")
  store.observe(element, 1)
  notify([{ target: element, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
  await vi.advanceTimersByTimeAsync(1500)
  return store.get(1)!
}

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

describe("card ping store summaries", () => {
  it("rounds the average of the latest non-null reply from each probe", async () => {
    const summary = await readSummary({ step, metrics, ping: history, probes })
    expect(summary?.latency).toBe(28)
    expect(summary?.probes).toHaveLength(2)
    expect(summary?.probes).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "东京探测", latency: 21 }),
      expect.objectContaining({ name: "法兰克福探测", latency: 34 }),
    ]))
  })

  it("uses the server's loss object instead of recomputing from samples", async () => {
    const summary = await readSummary({ step, metrics, ping: history, probes, loss: { 9: 1.5, 2: 5.5 } })
    expect(summary?.loss).toBe(3.5)
    expect(summary?.probes).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "东京探测", loss: 0 }),
      expect.objectContaining({ name: "法兰克福探测", loss: 20 }),
    ]))
  })

  it("averages the individual ping rows when the loss object is absent", async () => {
    // The probes have different sample counts: (0 + 10 + 0 + 0 + 20) / 5 = 6.
    expect((await readSummary({ step, metrics, ping: history, probes }))?.loss).toBe(6)
  })

  it("sorts buckets by timestamp and averages probes within each bucket", async () => {
    const ping = [point(9, 120, 80, 4), point(2, 60, 30, 0), point(9, 60, 10, 8), point(2, 120, 100, 8)]
    expect((await readSummary({ step, metrics, ping, probes })).buckets).toEqual([
      { latency: 20, loss: 4 }, { latency: 90, loss: 6 },
    ])
  })

  it("keeps only the newest 12 buckets, even for reverse-ordered history", async () => {
    const ping = Array.from({ length: 15 }, (_, i) => point(9, (i + 1) * step, 30 + i, i)).reverse()
    const expected = Array.from({ length: 12 }, (_, i) => ({ latency: 33 + i, loss: 3 + i }))
    expect((await readSummary({ step, metrics, ping, probes })).buckets).toEqual(expected)
  })

  it("returns an empty summary for an empty ping array", async () => {
    expect((await readSummary({ step, metrics, ping: [], probes: {} }))).toEqual({ latency: null, loss: null, probes: [], buckets: [] })
  })

  it("returns the same empty summary for invalid input", async () => {
    expect((await readSummary({ ping: null }))).toEqual({ latency: null, loss: null, probes: [], buckets: [] })
  })

  it("keeps loss data when every latency is null", async () => {
    const summary = await readSummary({ step, metrics, ping: [point(9, 60, null, 100), point(2, 60, null, 100)], probes })
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
