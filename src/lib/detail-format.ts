/** Detail-only display helpers. The format facade keeps the component imports stable. */
import { num } from "./api"
import { bytes, cycleSuffix, unitOf } from "./format-core"

export function axisBytes(v: number): string {
  if (!v || v < 0) return "0 B"
  return bytes(v, v / 1024 ** unitOf(v) >= 100 ? 0 : 1).replace(".0 ", " ")
}

export function cpuName(name?: string | null): string {
  if (!name) return ""
  return name
    .replace(/\((R|TM|r|tm)\)/g, "")
    .replace(/\s+(CPU|Processor)\b/g, "")
    .replace(/\s+\d+-Core\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

let money: Map<string, Intl.NumberFormat> | undefined

function formatMoney(amount: number, currency: string, digits: 0 | 2): string {
  const value = num(amount) ? amount : 0
  try {
    if (!currency || typeof currency !== "string") throw new Error("invalid currency")
    const key = `${currency}:${digits}`
    const cache = money ??= new Map()
    let format = cache.get(key)
    if (!format) {
      format = new Intl.NumberFormat("zh-CN", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits })
      cache.set(key, format)
    }
    return format.format(value)
  } catch {
    return `${currency ?? ""} ${value.toFixed(digits)}`.trim()
  }
}

// The detail page retains the locale's full currency notation.
export function priceFull(amount: number, currency: string, cycle?: string | null): string {
  return formatMoney(amount, currency, Number.isInteger(amount) ? 0 : 2) + cycleSuffix(cycle)
}
