import { describe, expect, it } from "vitest"
import { bytes, expiry, offlineFor, priceShort, regionName, speed } from "../../src/lib/format"

const MiB = 1024 ** 2
const now = Date.parse("2026-11-21T12:00:00Z")
const nowSeconds = now / 1000

describe("format", () => {
  it.each([
    [0, "0 B"], [-1, "0 B"], [NaN, "0 B"], [Infinity, "0 B"],
    [999, "999 B"], [1000, "0.98 KB"], [1011, "0.99 KB"], [1023, "1.00 KB"], [1024, "1.00 KB"], [1536, "1.50 KB"],
    [999 * 1024, "999 KB"], [1000 * 1024, "0.98 MB"], [1011 * 1024, "0.99 MB"],
    [1023 * 1024, "1.00 MB"], [1024 * 1024, "1.00 MB"],
    [12.25 * MiB, "12.3 MB"], [200 * MiB, "200 MB"], [1024 ** 3, "1.00 GB"],
  ])("bytes(%s) = %s", (value, text) => expect(bytes(value)).toBe(text))

  it("formats rates as bytes per second, not bits per second", () => {
    expect(speed(0)).toBe("0 B/s")
    expect(speed(1536)).toBe("1.50 KB/s")
    expect(speed(1011 * 1024)).toBe("0.99 MB/s")
  })

  it("localizes valid region codes and falls back to the original invalid code", () => {
    expect(regionName("HK")).toBe("香港")
    expect(regionName("not-a-region")).toBe("not-a-region")
  })

  it.each([
    ["monthly", "/月"], ["quarterly", "/季"], ["semiannual", "/半年"], ["yearly", "/年"],
    ["biennial", "/2年"], ["triennial", "/3年"], ["once", "/一次性"],
    ["60m", "/60月"], ["12m", "/12月"], ["1200m", "/1200月"],
    ["0m", "/0m"], ["1201m", "/1201m"], ["1.5m", "/1.5m"], ["乱写的值", "/乱写的值"],
    ["toString", "/toString"], ["", ""], [null, ""],
  ])("formats billing cycle %s through priceShort", (cycle, suffix) => {
    expect(priceShort(12, "CNY", cycle)).toBe(`¥12${suffix}`)
  })

  it.each([
    [-3, "已过期 3 天", "expired"], [0, "今天到期", "soon"], [5, "5 天后到期", "soon"],
    [60, "60 天后到期", "ok"], [null, "", "none"],
  ] as const)("prefers expires_in: %s, even over a valid expires_at", (days, text, level) => {
    expect(expiry({ expires_in: days, expires_at: "2028-01-01" }, now)).toEqual({ days, text, level })
  })

  it("calculates expiry from the browser clock only when the Hub omits expires_in", () => {
    expect(expiry({ expires_at: "2026-11-26T12:00:00Z" }, now)).toEqual({ days: 5, text: "5 天后到期", level: "soon" })
    expect(expiry({ expires_at: "bad date" }, now)).toEqual({ days: null, text: "", level: "none" })
  })

  it("only displays offline duration when explicitly offline", () => {
    expect(offlineFor({ online: true, last_seen_ago: 3660 }, now)).toBeNull()
    expect(offlineFor({ last_seen_ago: 3660 }, now)).toBeNull()
  })

  it("prefers the Hub-provided offline duration, even when null", () => {
    expect(offlineFor({ online: false, last_seen_ago: 3660, last_seen: nowSeconds }, now)).toBe("1 小时 1 分")
    expect(offlineFor({ online: false, last_seen_ago: null, last_seen: nowSeconds }, now)).toBe("从未上报")
    expect(offlineFor({ online: false, last_seen_ago: 0 }, now)).toBe("0 秒")
  })

  it("uses last_seen when last_seen_ago is missing, including legacy zero and null", () => {
    expect(offlineFor({ online: false, last_seen: nowSeconds - 125 }, now)).toBe("2 分")
    expect(offlineFor({ online: false, last_seen: 0 }, now)).toBe("从未上报")
    expect(offlineFor({ online: false, last_seen: null }, now)).toBe("从未上报")
  })
})


describe("priceShort", () => {
  it.each([
    ["monthly", "/月"], ["quarterly", "/季"], ["semiannual", "/半年"],
    ["yearly", "/年"], ["biennial", "/2年"], ["triennial", "/3年"],
    ["18m", "/18月"], ["60m", "/60月"],
  ])("uses the compact %s suffix and omits .00 for integer prices", (cycle, suffix) => {
    expect(priceShort(1188, "CNY", cycle)).toBe(`¥1,188${suffix}`)
  })

  it("uses the same slash separator for one-time pricing", () => {
    expect(priceShort(629, "CNY", "once")).toBe("¥629/一次性")
  })

  it.each([[86.4, "US$86.40/季"], [86.45, "US$86.45/季"]] as const)("keeps two decimals for a fractional USD price of %s", (amount, expected) => {
    expect(priceShort(amount, "USD", "quarterly")).toBe(expected)
  })

  it.each([[12, "BAD-CODE 12/月"], [12.5, "BAD-CODE 12.50/月"]] as const)("falls back to the literal invalid currency code for %s", (amount, expected) => {
    expect(priceShort(amount, "BAD-CODE", "monthly")).toBe(expected)
  })
})
