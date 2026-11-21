import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { convert, fetchRates, type Rates } from "@/lib/rates"
import { cdnRatePayload, cdnRateUrl, openRatePayload, openRateUrl, rateDate, ratesPerCny } from "../fixtures/exchange-rates"

const now = Date.parse("2026-11-22T03:00:00Z")
const twelveHours = 12 * 60 * 60 * 1000
const valid: Rates = { base: "CNY", date: rateDate, rates: ratesPerCny }
const storage = new Map<string, string>()

beforeEach(() => {
  storage.clear()
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
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

describe("fetchRates", () => {
  it("uses Open ER API, normalizes the date and caches it under the requested base", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(openRatePayload()))
    await expect(fetchRates("CNY", fetcher, now)).resolves.toEqual(valid)
    expect(requested(fetcher)).toEqual([openRateUrl()])
    expect(storage.has("dys:rates:CNY")).toBe(true)
  })

  it("uses a fresh cache entry without any provider request", async () => {
    const populate = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(openRatePayload()))
    await expect(fetchRates("CNY", populate, now)).resolves.toEqual(valid)
    const fetcher = vi.fn<typeof fetch>()
    await expect(fetchRates("CNY", fetcher, now + twelveHours - 1)).resolves.toEqual(valid)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("replaces an expired entry with a fresh quote", async () => {
    const fresh = { ...ratesPerCny, USD: 0.13 }
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(openRatePayload()))
      .mockResolvedValueOnce(Response.json({ ...openRatePayload(), rates: fresh }))
    await fetchRates("CNY", fetcher, now)
    await expect(fetchRates("CNY", fetcher, now + twelveHours + 1)).resolves.toEqual({ ...valid, rates: fresh })
    expect(requested(fetcher)).toEqual([openRateUrl(), openRateUrl()])
  })

  it("still returns live rates when localStorage reads and writes throw", async () => {
    const unavailable = () => { throw new DOMException("Storage blocked", "SecurityError") }
    const getItem = vi.fn(unavailable)
    const setItem = vi.fn(unavailable)
    vi.stubGlobal("localStorage", { getItem, setItem })
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(openRatePayload()))
    await expect(fetchRates("CNY", fetcher, now)).resolves.toEqual(valid)
    expect(getItem).toHaveBeenCalledWith("dys:rates:CNY")
    expect(setItem).toHaveBeenCalledWith("dys:rates:CNY", expect.any(String))
  })

  it("falls back after Open ER API reports an error, with a lowercase CDN path and uppercase rate keys", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ result: "error", "error-type": "unsupported-code" }))
      .mockResolvedValueOnce(Response.json(cdnRatePayload("USD")))
    await expect(fetchRates("USD", fetcher, now)).resolves.toEqual({
      base: "USD", date: rateDate, rates: openRatePayload("USD").rates,
    })
    expect(requested(fetcher)).toEqual([openRateUrl("USD"), cdnRateUrl("USD")])
  })

  it("returns null when Open ER API and jsDelivr both fail", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    await expect(fetchRates("CNY", fetcher, now)).resolves.toBeNull()
    expect(requested(fetcher)).toEqual([openRateUrl(), cdnRateUrl()])
  })

  it("gives each provider its own five-second timeout", async () => {
    vi.useFakeTimers()
    // Native AbortSignal.timeout does not use Vitest's fake clock.
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      const controller = new AbortController()
      setTimeout(() => controller.abort(new DOMException("timed out", "TimeoutError")), ms)
      return controller.signal
    })
    const aborted: string[] = []
    const fetcher = vi.fn<typeof fetch>((url, init) => new Promise((_resolve, reject) => {
      const signal = init?.signal
      signal?.addEventListener("abort", () => { aborted.push(String(url)); reject(signal.reason) }, { once: true })
    }))
    const pending = fetchRates("CNY", fetcher, now)
    void pending.catch(() => {})
    await vi.advanceTimersByTimeAsync(4999)
    expect(requested(fetcher)).toEqual([openRateUrl()])
    expect(aborted).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(requested(fetcher)).toEqual([openRateUrl(), cdnRateUrl()])
    expect(aborted).toEqual([openRateUrl()])
    await vi.advanceTimersByTimeAsync(4999)
    expect(aborted).toEqual([openRateUrl()])
    await vi.advanceTimersByTimeAsync(1)
    await expect(pending).resolves.toBeNull()
    expect(aborted).toEqual([openRateUrl(), cdnRateUrl()])
  })
})

describe("convert", () => {
  it("returns the same amount for the same currency without needing a table", () => {
    expect(convert(42, "CAD", "CAD", null)).toBe(42)
  })
  it("returns null for missing rates or an unsupported source or destination", () => {
    expect(convert(42, "CAD", "CNY", null)).toBeNull()
    expect(convert(42, "ZZZ", "CNY", valid)).toBeNull()
    expect(convert(42, "CNY", "ZZZ", valid)).toBeNull()
  })
  it("converts via the common base in both directions and across currencies", () => {
    expect(convert(80, "CNY", "USD", valid)).toBeCloseTo(10)
    expect(convert(10, "USD", "CNY", valid)).toBeCloseTo(80)
    expect(convert(10, "USD", "EUR", valid)).toBeCloseTo(8)
  })
})
