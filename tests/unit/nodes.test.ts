import { Blob as NativeBlob } from "node:buffer"
import { ReadableStream } from "node:stream/web"
import { gzipSync } from "node:zlib"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ALL_GROUP, speedHistory } from "../../src/lib/api"
import { createNodeStore, type NodeStoreOptions } from "../../src/lib/nodes.svelte"
import { metricFixture, nodeFixture } from "../fixtures/nodes"

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

function snapshot(name: string, rx = 600) {
  return { nodes: [nodeFixture({ name, metrics: metricFixture({ net_rx: rx }) })] }
}
const reply = (name: string) => Response.json(snapshot(name))
const stores: ReturnType<typeof createNodeStore>[] = []

function harness(options: Partial<NodeStoreOptions> = {}) {
  const events: string[] = []
  const sockets: Socket[] = []
  class Socket {
    static readonly OPEN = 1
    readyState = Socket.OPEN
    onmessage: ((event: { data: unknown }) => void) | null = null
    onerror: (() => void) | null = null
    onclose: (() => void) | null = null
    close = vi.fn(() => {
      if (this.readyState === 3) return
      this.readyState = 3
      this.onclose?.()
    })
    constructor(readonly url: string) {
      sockets.push(this)
      events.push("ws")
    }
    message(data: unknown) { this.onmessage?.({ data }) }
  }
  class DocumentStub extends EventTarget {
    hidden = false
    visibility(hidden: boolean) {
      this.hidden = hidden
      this.dispatchEvent(new Event("visibilitychange"))
    }
  }
  const doc = new DocumentStub()
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
    events.push("fetch")
    return reply("initial")
  })
  const store = createNodeStore({
    WebSocket: Socket as unknown as typeof WebSocket, fetch: fetcher, document: doc,
    location: { protocol: "http:", host: "mock.invalid" }, autoStart: false,
    pollIntervalMs: 1000, reconnectBaseMs: 2000, staleTimeoutMs: 10_000, ...options,
  })
  stores.push(store)
  return { store, sockets, doc, fetcher, events }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  stores.splice(0).forEach((store) => store.stop())
  speedHistory.clear()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms)

describe("node store reconciliation", () => {
  it("reuses unchanged nodes across WebSocket frames and applies reorders, changes and removals", async () => {
    const { store, sockets } = harness()
    const unchanged = nodeFixture({ id: 1 }), changed = nodeFixture({ id: 2 }), removed = nodeFixture({ id: 3 })
    store.start(Promise.resolve({ nodes: [unchanged, changed, removed] }))
    await tick()
    const previous = store.nodes!
    const changedCopy = nodeFixture({ id: 2, metrics: metricFixture({ load: [0.1, 0.2, 0.9] }) })
    const added = nodeFixture({ id: 4 })
    sockets[0].message(JSON.stringify({ nodes: [changedCopy, added, nodeFixture({ id: 1 })] }))
    await tick()
    expect(store.nodes!.map(({ id }) => id)).toEqual([2, 4, 1])
    expect(store.nodes![0]).not.toBe(previous[1])
    expect(store.nodes![0]).toEqual(changedCopy)
    expect(store.nodes![1]).toEqual(added)
    expect(store.nodes![2]).toBe(previous[0])
  })
})

describe("node store", () => {
  it("consumes the supplied startup snapshot once and reports connected before the first WS frame", async () => {
    const { store, sockets, fetcher } = harness()
    const startup = deferred<ReturnType<typeof snapshot>>()
    store.start(startup.promise)
    expect(store.connectionState).toBe("connecting")
    expect(fetcher).not.toHaveBeenCalled()
    expect(sockets).toHaveLength(0)

    startup.resolve(snapshot("HTTP startup"))
    await tick()
    expect(store.nodes?.[0].name).toBe("HTTP startup")
    expect(store.connectionState).toBe("connected")
    expect(fetcher).not.toHaveBeenCalled()
    expect(sockets).toHaveLength(1)

    sockets[0].message(JSON.stringify(snapshot("live")))
    await tick()
    expect(store.connectionState).toBe("live")
    sockets[0].close()
    expect(store.connectionState).toBe("polling")
  })

  it("decodes a gated gzip frame before a later text frame and commits both in order", async () => {
    vi.useRealTimers()
    // JSDOM's Blob has no stream(); use Node's Blob + native gzip decompression.
    vi.stubGlobal("Blob", NativeBlob)
    const { store, sockets } = harness()
    store.start()
    await vi.waitFor(() => expect(sockets).toHaveLength(1))
    await vi.waitFor(() => expect(store.nodes?.[0].name).toBe("initial"))
    expect(sockets[0].url).toBe("ws://mock.invalid/api/ws?gzip")
    const release = deferred<void>()
    const gzip = gzipSync(JSON.stringify(snapshot("first gzip", 101)))
    class SlowBlob extends NativeBlob {
      override stream(): ReturnType<NativeBlob["stream"]> {
        return new ReadableStream<Uint8Array<ArrayBuffer>>({
          async start(controller) {
            await release.promise
            controller.enqueue(Uint8Array.from(gzip))
            controller.close()
          },
        })
      }
    }
    const first = new SlowBlob([gzip])
    const stream = vi.spyOn(first, "stream")
    sockets[0].message(first)
    sockets[0].message(JSON.stringify(snapshot("second text", 202)))
    await vi.waitFor(() => expect(stream).toHaveBeenCalledTimes(1))
    expect(store.nodes?.[0].name).toBe("initial")
    release.resolve()
    await vi.waitFor(() => expect(store.nodes?.[0].name).toBe("second text"))
    expect(speedHistory.get(ALL_GROUP)?.map(({ rx }) => rx)).toEqual([600, 101, 202])
    expect(store.connected).toBe(true)
  })

  it("extends the watchdog only after successfully decoding a valid snapshot", async () => {
    const { store, sockets } = harness({ staleTimeoutMs: 1000 })
    store.start()
    await tick()
    await tick(750)
    sockets[0].message(JSON.stringify(snapshot("valid")))
    await tick()
    expect(store.nodes?.[0].name).toBe("valid")
    await tick(550)
    expect(sockets).toHaveLength(1) // past the original t=1000 deadline
    sockets[0].message("not JSON")
    await tick(350)
    sockets[0].message(JSON.stringify({ nodes: null }))
    await tick(99)
    expect(sockets).toHaveLength(1)
    await tick(1) // t=1750, one second after the only valid frame
    expect(sockets[0].close).toHaveBeenCalledOnce()
    expect(sockets).toHaveLength(2)
    expect(store.connected).toBe(false)
  })

  it("polls after close, backs off successive reconnects, and stops polling after a valid frame", async () => {
    const { store, sockets, fetcher } = harness()
    store.start()
    await tick()
    sockets[0].close()
    expect(store.connected).toBe(false)
    await tick(999)
    expect(fetcher).toHaveBeenCalledTimes(1)
    await tick(1)
    expect(fetcher).toHaveBeenCalledTimes(2)
    await tick(999)
    expect(sockets).toHaveLength(1)
    await tick(1)
    expect(sockets).toHaveLength(2)
    sockets[1].close()
    await tick(3999)
    expect(sockets).toHaveLength(2)
    await tick(1)
    expect(sockets).toHaveLength(3)
    sockets[2].message(JSON.stringify(snapshot("live")))
    await tick()
    expect(store.connected).toBe(true)
    expect(store.nodes?.[0].name).toBe("live")
    const count = fetcher.mock.calls.length
    await tick(2000)
    expect(fetcher).toHaveBeenCalledTimes(count)
  })

  it("halts socket and polling when hidden, drops a late poll, and awaits a fresh snapshot before reopening", async () => {
    const { store, sockets, fetcher, doc, events } = harness({ reconnectBaseMs: 1500 })
    store.start()
    await tick()
    expect(store.nodes?.[0].name).toBe("initial")
    sockets[0].close()
    const oldPoll = deferred<Response>()
    fetcher.mockImplementationOnce(() => oldPoll.promise)
    await tick(1500)
    expect(sockets).toHaveLength(2)
    expect(fetcher).toHaveBeenCalledTimes(2)
    doc.visibility(true)
    expect(sockets[1].close).toHaveBeenCalledOnce()
    await tick(8000)
    expect(sockets).toHaveLength(2)
    expect(fetcher).toHaveBeenCalledTimes(2)
    oldPoll.resolve(reply("stale poll"))
    await tick()
    expect(store.nodes?.[0].name).toBe("initial")

    const fresh = deferred<Response>()
    fetcher.mockImplementationOnce(() => { events.push("fresh fetch"); return fresh.promise })
    events.length = 0
    doc.visibility(false)
    expect(fetcher).toHaveBeenCalledTimes(3)
    await tick(100)
    expect(events).toEqual(["fresh fetch"])
    expect(sockets).toHaveLength(2)
    fresh.resolve(reply("fresh"))
    await tick()
    expect(events).toEqual(["fresh fetch", "ws"])
    expect(sockets).toHaveLength(3)
    expect(store.nodes?.[0].name).toBe("fresh")
  })

  it("does not reopen a socket when hidden again before the fresh request finishes", async () => {
    const { store, sockets, fetcher, doc } = harness()
    store.start()
    await tick()
    expect(sockets).toHaveLength(1)
    doc.visibility(true)
    const pending = deferred<Response>()
    fetcher.mockImplementationOnce(() => pending.promise)
    doc.visibility(false)
    doc.visibility(true)
    pending.resolve(reply("discard this snapshot"))
    await tick()
    expect(sockets).toHaveLength(1)
    expect(store.nodes?.[0].name).toBe("initial")
  })

  it("reschedules an active polling interval when setPollInterval changes", async () => {
    const { store, sockets, fetcher } = harness({ reconnectBaseMs: 15_000 })
    store.start()
    await tick()
    sockets[0].close()
    await tick(1000)
    expect(fetcher).toHaveBeenCalledTimes(2)
    store.setPollInterval(3)
    await tick(2999)
    expect(fetcher).toHaveBeenCalledTimes(2)
    await tick(1)
    expect(fetcher).toHaveBeenCalledTimes(3)
    await tick(3000)
    expect(fetcher).toHaveBeenCalledTimes(4)
  })
})
