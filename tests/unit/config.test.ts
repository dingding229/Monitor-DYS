import { afterEach, describe, expect, it, vi } from "vitest"
import { loadSiteConfig, resolveConfig } from "../../src/lib/config"
import manifest from "../../theme.json"

const defaults = Object.fromEntries(manifest.config.flatMap((field) => "key" in field ? [[field.key, field.default]] : []))

afterEach(() => vi.unstubAllGlobals())

describe("resolveConfig", () => {
  it("accepts valid values for each non-title type", () => {
    const valid = {
      layout: "table", card_size: "standard", accent_color: " #AbC ",
      show_summary: false, show_map: false, show_search: false, show_sort: false, show_billing: false, show_ping: false,
      expiry_warning_days: 3, visitor_info_enabled: false,
      announcement: "第一行\n第二行", footer: "A footer", footer_url: "https://example.invalid/about", poll_interval: 2,
    }
    expect(resolveConfig(manifest, valid)).toEqual({ ...valid, accent_color: "#aabbcc" })
    expect(resolveConfig(manifest.config, { poll_interval: 60 }).poll_interval).toBe(60)
  })

  it("rejects invalid values per field, skips titles and ignores undeclared keys", () => {
    const fields = [...manifest.config, { type: "title", label: "Test title", key: "heading", default: "ignored" }]
    expect(resolveConfig(fields, {
      layout: "unknown", card_size: 3, accent_color: "unknown", show_summary: "false", show_billing: 1,
      show_map: "false", show_search: null, show_sort: 1, show_ping: "false", expiry_warning_days: 366,
      visitor_info_enabled: "false", announcement: null, footer: ["not a string"], footer_url: "ftp://example.invalid",
      poll_interval: "5", heading: "not a setting", secret: "undeclared",
    })).toEqual(defaults)
    expect(resolveConfig(manifest, { show_summary: false, poll_interval: 999 })).toEqual({ ...defaults, show_summary: false })
  })

  it.each([1, 61, 999, NaN, Infinity, null, "5"])("rejects poll_interval %s", (value) => {
    expect(resolveConfig(manifest, { poll_interval: value }).poll_interval).toBe(5)
  })


})

describe("loadSiteConfig", () => {
  it("reads changed keys and merges with manifest defaults", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ layout: "table", announcement: "更新", extra: true }))
    await expect(loadSiteConfig({ fetch: fetcher })).resolves.toEqual({ config: { ...defaults, layout: "table", announcement: "更新" }, loaded: true })
    expect(fetcher.mock.calls[0][0]).toBe("/api/themes/dys/config")
  })

  it.each([404, 401, 502])("falls back silently on HTTP %i", async (status) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("unavailable", { status }))
    await expect(loadSiteConfig({ fetch: fetcher })).resolves.toEqual({ config: defaults, loaded: false })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("falls back silently on a network error", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("offline"))
    await expect(loadSiteConfig({ fetch: fetcher })).resolves.toEqual({ config: defaults, loaded: false })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})

it("distinguishes a successful settings read from a failed read while keeping display defaults", async () => {
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({}))
    .mockResolvedValueOnce(new Response(null, { status: 404 }))
  await expect(loadSiteConfig({ fetch: fetcher })).resolves.toEqual({ config: defaults, loaded: true })
  await expect(loadSiteConfig({ fetch: fetcher })).resolves.toEqual({ config: defaults, loaded: false })
})


describe("accent_color configuration", () => {
  it.each([["#abc", "#aabbcc"], ["#ABCDEF", "#abcdef"], ["  #1A2  ", "#11aa22"], [" #3B82F6 ", "#3b82f6"]])("normalizes %s", (value, expected) => {
    expect(resolveConfig(manifest, { accent_color: value }).accent_color).toBe(expected)
  })
  it.each(["red", "#ab", "#abcd", "#ggg", "#12345678", "", null, undefined, 3, false, {}, []])("falls back for %s", value => {
    expect(resolveConfig(manifest, { accent_color: value }).accent_color).toBe("#10b981")
  })
  it("ignores obsolete color keys even when declared", () => {
    const old = [{ type: "string", key: "theme", default: "ocean" }, { type: "string", key: "accent", default: "#fff" }, { type: "string", key: "color_scheme", default: "dark" }]
    expect(resolveConfig([...manifest.config, ...old], { theme: "rose", accent: "#f00", color_scheme: "dark" })).toEqual(defaults)
  })
})
