import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { accentPalette, applyAccent, paintAccent, readCachedAccent, resolveAccent } from "../../src/lib/theme"

const key = "dys:accent"
const fields = ["accent", "strong", "soft", "border", "text"] as const
const cssName = (field: typeof fields[number]) => field === "accent" ? "--accent" : `--accent-${field}`
function luminance(hex: string) {
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute("style") })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); document.documentElement.removeAttribute("style") })

describe("resolveAccent", () => {
  it.each([["#ABC", "#aabbcc"], [" #123 ", "#112233"], [" #3B82F6 ", "#3b82f6"], ["#10b981", "#10b981"]])("normalizes %s", (value, expected) => expect(resolveAccent(value)).toBe(expected))
  it.each(["", "red", "#12", "#12gg99", "#1234", "#12345678", null, undefined, true, 123, {}, []])("rejects %s", value => expect(resolveAccent(value)).toBe("#10b981"))
})

describe("accentPalette", () => {
  const random = Array.from({ length: 40 }, (_, i) => `#${((i * 2654435761 + 12345) >>> 0).toString(16).slice(-6).padStart(6, "0")}`)
  it.each(["#10b981", "#3b82f6", "#facc15", "#ffffff", "#09090b", ...random])("provides valid accessible colors for %s", color => {
    const p = accentPalette(color)
    expect(Object.keys(p).sort()).toEqual([...fields].sort())
    for (const field of fields) expect(p[field]).toMatch(/^#[0-9a-f]{6}$/)
    expect(p.accent).toBe(color)
    expect(contrast(p.strong, "#ffffff")).toBeGreaterThanOrEqual(4.5)
    expect(contrast(p.text, p.soft)).toBeGreaterThanOrEqual(4.5)
  })
  it("matches all default CSS variables", () => {
    const css = readFileSync(resolve("src/app.css"), "utf8")
    const root = /:root\s*\{([^}]*)\}/.exec(css)?.[1]
    expect(root).toBeTruthy()
    const palette = accentPalette("#10b981")
    for (const field of fields) expect(new RegExp(`${cssName(field)}:\\s*${palette[field]}\\s*;`, "i").test(root!)).toBe(true)
  })
})

describe("accent cache and painting", () => {
  it("reads a valid cached palette", () => {
    const palette = accentPalette("#3b82f6")
    localStorage.setItem(key, JSON.stringify(palette))
    expect(readCachedAccent()).toEqual(palette)
  })
  it.each([
    ["missing field", JSON.stringify({ ...accentPalette("#3b82f6"), border: undefined })],
    ["invalid color", JSON.stringify({ ...accentPalette("#3b82f6"), text: "#FFF" })],
    ["damaged JSON", "{"], ["missing cache", null],
  ])("rejects %s", (_label, value) => {
    if (value !== null) localStorage.setItem(key, value)
    expect(readCachedAccent()).toBeNull()
  })
  it("handles unavailable storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied") })
    expect(readCachedAccent()).toBeNull()
  })
  it("applyAccent paints every variable and persists the palette", () => {
    const palette = accentPalette("#3b82f6")
    applyAccent(palette)
    for (const field of fields) expect(document.documentElement.style.getPropertyValue(cssName(field))).toBe(palette[field])
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(palette)
  })
  it("paintAccent changes all variables without touching cached data", () => {
    const stored = accentPalette("#10b981"), palette = accentPalette("#facc15")
    localStorage.setItem(key, JSON.stringify(stored))
    paintAccent(palette)
    for (const field of fields) expect(document.documentElement.style.getPropertyValue(cssName(field))).toBe(palette[field])
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(stored)
  })
})
