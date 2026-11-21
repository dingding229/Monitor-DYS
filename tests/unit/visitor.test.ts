import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchVisitor, normalizeGeo, parseUA } from "@/lib/visitor"
import { IPSB_URL, IPWHO_URL, ipsbResponse, ipwhoFailure, ipwhoResponse } from "../fixtures/visitor-geo"

const ipsbGeo = {
  ip: "203.0.113.10", countryCode: "JP", country: "Japan", region: "Tokyo Metropolis",
  city: "Tokyo", isp: expect.stringContaining("Tokyo Test Network"),
}
const ipwhoGeo = {
  ip: "2001:db8::20", countryCode: "DE", country: "Germany", region: "Hesse",
  city: "Frankfurt am Main", isp: expect.stringContaining("Frankfurt Test Network"),
}

const chromeWin = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
const chromeAndroid = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.127 Mobile Safari/537.36"
const cases = [
  ["Chrome on Windows", chromeWin, "Chrome", "131.0.0.0", "Windows", "desktop"],
  ["Edge", `${chromeWin} Edg/131.0.2903.112`, "Edge", "131.0.2903.112", "Windows", "desktop"],
  ["Safari on macOS", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15", "Safari", "17.6", "macOS", "desktop"],
  ["iOS Safari", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1", "Safari", "17.6", "iOS", "mobile"],
  ["iPad", "Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1", "Safari", "17.6", "iOS", "tablet"],
  ["Android Chrome", chromeAndroid, "Chrome", "128.0.6613.127", "Android", "mobile"],
  ["Firefox", "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0", "Firefox", "132.0", "Linux", "desktop"],
  ["微信", "Mozilla/5.0 (Linux; Android 13; V2217A Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 XWEB/1160117 MMWEBSDK/20231001 MMWEBID/3336 MicroMessenger/8.0.43.2480(0x28002B35) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64", "微信", "8.0.43.2480", "Android", "mobile"],
  ["QQ 浏览器", "Mozilla/5.0 (Linux; U; Android 12; zh-cn; M2102K1C Build/SKQ1.211006.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/96.0.4664.104 Mobile Safari/537.36 MQQBrowser/13.6", "QQ 浏览器", "13.6", "Android", "mobile"],
  ["Opera", `${chromeWin} OPR/115.0.0.0`, "Opera", "115.0.0.0", "Windows", "desktop"],
] as const

describe("parseUA", () => {
  it.each(cases)("identifies %s even with compatibility tokens", (_, ua, browser, version, os, device) => {
    expect(parseUA(ua)).toEqual({ browser, version, os, device })
  })
})

describe("normalizeGeo", () => {
  it("picks the IP.SB country code and flat ISP field", () => {
    expect(normalizeGeo("ipsb", ipsbResponse)).toEqual(ipsbGeo)
  })

  it("reads ipwho.is connection.isp, not connection.org", () => {
    expect(normalizeGeo("ipwho", ipwhoResponse)).toEqual(ipwhoGeo)
  })

  it("treats ipwho.is success:false and invalid JSON shapes as no geolocation", () => {
    expect(normalizeGeo("ipwho", ipwhoFailure)).toBeNull()
    expect(normalizeGeo("ipwho", { ...ipwhoResponse, success: false })).toBeNull()
    expect(normalizeGeo("ipsb", { country: "Japan" })).toBeNull()
    expect(normalizeGeo("ipsb", null)).toBeNull()
  })
})

describe("fetchVisitor", () => {
  beforeEach(() => {
    const session = new Map<string, string>()
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => session.set(key, value),
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function requested(fetcher: ReturnType<typeof vi.fn<typeof fetch>>) {
    return fetcher.mock.calls.map(([target]) => target instanceof Request ? target.url : String(target))
  }

  it("returns IP.SB data and reuses the session result without a second request", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(ipsbResponse))
    await expect(fetchVisitor(fetcher)).resolves.toEqual(ipsbGeo)
    await expect(fetchVisitor(fetcher)).resolves.toEqual(ipsbGeo)
    expect(requested(fetcher)).toEqual([IPSB_URL])
  })

  it.each(["network", "HTTP", "invalid JSON", "invalid geo data"])("falls back to ipwho.is after IP.SB %s failure", async (failure) => {
    const fetcher = vi.fn<typeof fetch>()
    if (failure === "network") fetcher.mockRejectedValueOnce(new TypeError("network error"))
    else if (failure === "HTTP") fetcher.mockResolvedValueOnce(new Response(null, { status: 503 }))
    else if (failure === "invalid JSON") fetcher.mockResolvedValueOnce(new Response("not JSON"))
    else fetcher.mockResolvedValueOnce(Response.json({ country: "Japan" }))
    fetcher.mockResolvedValueOnce(Response.json(ipwhoResponse))
    await expect(fetchVisitor(fetcher)).resolves.toEqual(ipwhoGeo)
    expect(requested(fetcher)).toEqual([IPSB_URL, IPWHO_URL])
  })

  it("returns null when IP.SB fails and ipwho.is returns success:false over HTTP 200", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("network error"))
      .mockResolvedValueOnce(Response.json(ipwhoFailure))
    await expect(fetchVisitor(fetcher)).resolves.toBeNull()
    expect(requested(fetcher)).toEqual([IPSB_URL, IPWHO_URL])
  })

  it("aborts a pending IP.SB request after five seconds and then tries ipwho.is", async () => {
    vi.useFakeTimers()
    // The native implementation does not use Vitest's fake clock.
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      const controller = new AbortController()
      setTimeout(() => controller.abort(new DOMException("timed out", "TimeoutError")), ms)
      return controller.signal
    })
    let aborted = false
    const fetcher = vi.fn<typeof fetch>()
      .mockImplementationOnce((_, init) => new Promise((_resolve, reject) => {
        const signal = init?.signal
        signal?.addEventListener("abort", () => { aborted = true; reject(signal.reason) }, { once: true })
      }))
      .mockResolvedValueOnce(Response.json(ipwhoResponse))
    const result = fetchVisitor(fetcher)
    void result.catch(() => {}) // assertions below still surface errors after the fake clock advances
    await vi.advanceTimersByTimeAsync(4999)
    expect(requested(fetcher)).toEqual([IPSB_URL])
    expect(aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(requested(fetcher)).toEqual([IPSB_URL, IPWHO_URL])
    expect(aborted).toBe(true)
    await expect(result).resolves.toEqual(ipwhoGeo)
  })
})
