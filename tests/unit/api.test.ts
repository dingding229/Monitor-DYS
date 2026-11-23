import { afterEach, describe, expect, it, vi } from "vitest"
import { ALL_GROUP, ApiError, UNGROUPED, api, safeNodes, type Node } from "../../src/lib/api"
import { summarizeNodes } from "../../src/lib/home-view.svelte"
import { directory } from "../../src/lib/view-state"
import { metricFixture, nodeFixture } from "../fixtures/nodes"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("api", () => {
  it("prefixes paths once and uses GET with an abort signal", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ ok: true }))
    await expect(api("nodes", { fetch: fetcher })).resolves.toEqual({ ok: true })
    await expect(api("/api/nodes", { fetch: fetcher })).resolves.toEqual({ ok: true })
    for (const [url, init] of fetcher.mock.calls) {
      expect(url).toBe("/api/nodes")
      expect(init?.method ?? "GET").toBe("GET")
      expect(init?.signal).toBeInstanceOf(AbortSignal)
    }
  })

  it.each([
    [429, "text/plain; charset=utf-8", " 查询历史的请求太多，稍后再试\n", "查询历史的请求太多，稍后再试"],
    [401, "text/plain", "需要登录后查看", "需要登录后查看"],
    [502, "text/html", "<h1>proxy-only text</h1>", "服务暂时无法访问（HTTP 502），稍后再试"],
    [200, "text/html", "<h1>not JSON</h1>", "收到的不是状态数据，稍后再试"],
  ] as const)("classifies HTTP %i %s without leaking proxy bodies", async (status, type, body, message) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status, headers: { "content-type": type } }))
    const result = api("/nodes", { fetch: fetcher })
    await expect(result).rejects.toBeInstanceOf(ApiError)
    await expect(result).rejects.toMatchObject({ status, message })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("does not retry a non-timeout network error", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("connection refused"))
    await expect(api("nodes", { fetch: fetcher })).rejects.toMatchObject({ status: 0, message: "网络连接失败，稍后再试" })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("retries fetch timeout and abort during the response body using fresh 20-second signals", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout")
    const abortedBody = Response.json({})
    vi.spyOn(abortedBody, "json").mockRejectedValue(new DOMException("body timed out", "AbortError"))
    const fetcher = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new DOMException("connection timed out", "TimeoutError"))
      .mockResolvedValueOnce(abortedBody)
      .mockResolvedValueOnce(Response.json({ nodes: [] }))
    await expect(api("nodes", { fetch: fetcher })).resolves.toEqual({ nodes: [] })
    expect(timeout.mock.calls).toEqual([[20_000], [20_000], [20_000]])
    const signals = fetcher.mock.calls.map(([, opts]) => opts?.signal)
    expect(signals).not.toContain(undefined)
    expect(new Set(signals).size).toBe(3)
  })

  it("stops after the first attempt and six timeout retries by default", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new DOMException("timed out", "TimeoutError"))
    await expect(api("nodes", { fetch: fetcher })).rejects.toMatchObject({ status: 0, message: "网络连接失败，稍后再试" })
    expect(fetcher).toHaveBeenCalledTimes(7)
  })
})

describe("node snapshots", () => {
  it.each([
    { ...metricFixture(), cpu: "bad" }, { ...metricFixture(), load: [0.1, 0.2] },
    { ...metricFixture(), load: [0.1, "bad", 0.3] }, { ...metricFixture(), tcp: "bad" },
    { ...metricFixture(), net_tx: undefined }, undefined,
  ])("marks a malformed metrics payload without discarding valid neighbours (%#)", (metrics) => {
    const good = nodeFixture({ id: 2 })
    const malformed = { ...nodeFixture(), metrics } as Node
    const safe = safeNodes([malformed, good])
    expect(safe[0]).toMatchObject({ id: 1, metrics: null, _corrupt: true })
    expect(safe[1]).toBe(good)
  })

  it("distinguishes offline, waiting and legacy reports with omitted optional fields", () => {
    const waiting = nodeFixture({ online: true, metrics: null })
    const offline = nodeFixture({ online: false, metrics: null })
    const legacy = nodeFixture({ group: undefined, public_remark: undefined, metrics: metricFixture() })
    expect(safeNodes([waiting, offline, legacy])).toEqual([waiting, offline, legacy])
    expect(legacy.metrics).not.toHaveProperty("swap_used")
    expect(legacy.metrics).not.toHaveProperty("tcp")
    expect(legacy.metrics).not.toHaveProperty("udp")
    expect(legacy.metrics).not.toHaveProperty("procs")
  })

  it("preserves first-seen group order and accepts literal names matching reserved labels", () => {
    const nodes = ["欧洲", "", "亚太", "", "欧洲", "全部", "未分组"].map((group, id) => nodeFixture({ id, group }))
    const tabs = directory(nodes, ALL_GROUP, null, "", "default").tabs
    expect(tabs.map(tab => tab.key)).toEqual([ALL_GROUP, "欧洲", "亚太", "全部", "未分组", UNGROUPED])
    expect(directory([nodeFixture({ group: "" })], ALL_GROUP, null, "", "default").tabs).toEqual([])
  })

  it("keeps all, ungrouped, and identically named real groups separate in visible speed totals", () => {
    const nodes = [
      nodeFixture({ group: "全部", metrics: metricFixture({ net_rx: 10, net_tx: 20 }) }),
      nodeFixture({ group: "未分组", metrics: metricFixture({ net_rx: 30, net_tx: 40 }) }),
      nodeFixture({ metrics: metricFixture({ net_rx: 50, net_tx: 60 }) }),
      nodeFixture({ online: false }),
    ]
    const totals = (group: typeof ALL_GROUP | typeof UNGROUPED | string) => {
      const { rx, tx } = summarizeNodes(directory(nodes, group, null, "", "default").list)
      return { rx, tx }
    }
    expect(totals(ALL_GROUP)).toEqual({ rx: 90, tx: 120 })
    expect(totals(UNGROUPED)).toEqual({ rx: 50, tx: 60 })
    expect(totals("全部")).toEqual({ rx: 10, tx: 20 })
    expect(totals("未分组")).toEqual({ rx: 30, tx: 40 })
  })
})
