/** v2.0.1 custom accent. Palette keys match the first-paint cache and CSS variables. */
export const DEFAULT_ACCENT = "#10b981"
const CACHE_KEY = "dys:accent"
const fullHex = /^#[0-9a-f]{6}$/
const fields = ["accent", "strong", "soft", "border", "text"] as const
export type AccentPalette = Record<(typeof fields)[number], string>

export function resolveAccent(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_ACCENT
  let hex = value.trim().toLowerCase()
  if (hex.length === 4) hex = hex.replace(/[0-9a-f]/g, "$&$&")
  return fullHex.test(hex) ? hex : DEFAULT_ACCENT
}

function linear(byte: number): number {
  const c = byte / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

// WCAG 2.2 relative luminance of the actual quantized sRGB output.
const luminance = ([r, g, b]: number[]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
const hexColor = ([r, g, b]: number[]) => `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`

export function accentPalette(hex: string): AccentPalette {
  const accent = resolveAccent(hex)
  const rgb = Number.parseInt(accent.slice(1), 16)
  const channels = [rgb >> 16, (rgb >> 8) & 255, rgb & 255]
  const mix = (percent: number, target: number) => channels.map(c => Math.round((c * percent + target * (100 - percent)) / 100))
  function darken(background: number): string {
    // Mixing with black keeps the hue. Check the rounded channels before returning.
    for (let step = 100; ; step--) {
      const shade = mix(step, 0)
      if ((background + 0.05) / (luminance(shade) + 0.05) >= 4.5) return hexColor(shade)
    }
  }
  const soft = mix(8, 255)
  return { accent, strong: darken(1), soft: hexColor(soft), border: hexColor(mix(35, 255)), text: darken(luminance(soft)) }
}

export function readCachedAccent(): AccentPalette | null {
  try {
    const palette = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null")
    if (palette && fields.every(key => typeof palette[key] === "string" && palette[key].length === 7 && fullHex.test(palette[key]))) return palette
  } catch { /* Storage unavailable or malformed. */ }
  return null
}

/** Paint without caching a temporary fallback during startup. */
export function paintAccent(palette: AccentPalette) {
  const style = document.documentElement.style
  for (const key of fields) style.setProperty(key === "accent" ? "--accent" : `--accent-${key}`, palette[key])
}

export function applyAccent(palette: AccentPalette) {
  paintAccent(palette)
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(palette)) } catch { /* Storage unavailable. */ }
}
