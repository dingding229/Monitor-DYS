const DEFAULT_RGB: [number, number, number] = [37, 99, 235] // #2563eb

function parseHex(s: string): [number, number, number] | null {
  const m3 = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])?$/.exec(s)
  if (m3) {
    return [
      Number.parseInt(m3[1] + m3[1], 16),
      Number.parseInt(m3[2] + m3[2], 16),
      Number.parseInt(m3[3] + m3[3], 16),
    ]
  }
  const m6 = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})?$/.exec(s)
  if (m6) {
    return [
      Number.parseInt(m6[1], 16),
      Number.parseInt(m6[2], 16),
      Number.parseInt(m6[3], 16),
    ]
  }
  return null
}

function parseRgbString(s: string): [number, number, number] | null {
  const m = /^rgba?\(\s*(\d{1,3}(?:\.\d+)?)\s*(?:,|\s)\s*(\d{1,3}(?:\.\d+)?)\s*(?:,|\s)\s*(\d{1,3}(?:\.\d+)?)(?:\s*[,/]\s*[\d.]+%?)?\s*\)$/i.exec(
    s,
  )
  if (!m) return null
  const r = Math.min(255, Math.max(0, Math.round(Number(m[1]))))
  const g = Math.min(255, Math.max(0, Math.round(Number(m[2]))))
  const b = Math.min(255, Math.max(0, Math.round(Number(m[3]))))
  return [r, g, b]
}

function resolveRgbViaDom(raw: string): [number, number, number] | null {
  if (typeof document === "undefined" || typeof getComputedStyle !== "function") return null
  try {
    const el = document.createElement("span")
    el.style.color = ""
    el.style.color = raw
    if (!el.style.color) return null
    const parent = document.body || document.documentElement
    if (!parent) return parseRgbString(el.style.color)
    parent.appendChild(el)
    const computed = getComputedStyle(el).color
    el.remove()
    return parseRgbString(computed) ?? parseHex(computed)
  } catch {
    return null
  }
}

const NAMED_COLORS: Record<string, [number, number, number]> = {
  rebeccapurple: [102, 51, 153],
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  yellow: [255, 255, 0],
  cyan: [0, 255, 255],
  magenta: [255, 0, 255],
  orange: [255, 165, 0],
  purple: [128, 0, 128],
  pink: [255, 192, 203],
  teal: [0, 128, 128],
  indigo: [75, 0, 130],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
}

export function toRgb(color: string): [number, number, number] {
  if (typeof color !== "string") return DEFAULT_RGB
  const s = color.trim()
  if (!s) return DEFAULT_RGB

  const hex = parseHex(s)
  if (hex) return hex

  const rgb = parseRgbString(s)
  if (rgb) return rgb

  const lower = s.toLowerCase()
  if (Object.prototype.hasOwnProperty.call(NAMED_COLORS, lower)) {
    return NAMED_COLORS[lower]
  }

  const domRgb = resolveRgbViaDom(s)
  if (domRgb) return domRgb

  return DEFAULT_RGB
}

/**
 * Convert any valid CSS color to `rgba(r, g, b, alpha)`, falling back to `#2563eb` (`rgb(37, 99, 235)`) on invalid input.
 */
export function withAlpha(color: string, alpha: number): string {
  const [r, g, b] = toRgb(color)
  const a = typeof alpha === "number" && Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1
  const aStr = Number(a.toFixed(3))
  return `rgba(${r}, ${g}, ${b}, ${aStr})`
}
