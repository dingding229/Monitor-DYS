import { describe, expect, it } from "vitest"
import { bytes, cycleMonths, expiry, money, offlineFor, percent, regionName, speed } from "../../src/lib/format"

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
    [0, "0%"], [0.5, "0.5%"], [0.99, "1.0%"], [1, "1%"],
    [3.2, "3.2%"], [25.6, "26%"], [100, "100%"], [-4, "0%"], [NaN, "0%"],
  ])("percent(%s) treats input as a percent", (value, text) => expect(percent(value)).toBe(text))

  it("keeps the used/total overload", () => {
    expect(percent(0.5, 1)).toBe("50%")
    expect(percent(1, 200)).toBe("0.5%")
    expect(percent(100, 0)).toBe("0%")
  })

  it.each([["USD", "US$12.50"], ["HKD", "HK$12.50"], ["JPY", "JP¥12.5"], ["bad-code", "bad-code 12.50"]])(
    "formats %s in zh-CN or falls back when invalid", (currency, text) => expect(money(12.5, currency)).toBe(text),
  )

  it.each<[string, number]>([
    ["monthly", 1], ["quarterly", 3], ["semiannual", 6], ["yearly", 12], ["biennial", 24],
    ["triennial", 36], ["once", 0], ["60m", 60], ["12m", 12], ["1200m", 1200],
  ])("cycleMonths(%s) = %s", (cycle, months) => expect(cycleMonths(cycle)).toBe(months))

  it.each(["0m", "1201m", "1.5m", "乱写的值", "toString", "", null])(
    "rejects billing cycle %s", (cycle) => expect(cycleMonths(cycle)).toBeNaN(),
  )

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
