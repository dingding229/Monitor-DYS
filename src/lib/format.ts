/**
 * Derived in part from monitor-theme-default (MIT, Copyright (c) 2026 stqfdyr).
 */

import { num, type Node } from "./api"

const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"]

const unitOf = (n: number) => {
  let i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), UNITS.length - 1)
  if (i < UNITS.length - 1 && n / 1024 ** i >= 1000) {
    i++
  }
  return i
}

export function bytes(n: number, digits?: number): string {
  if (!num(n) || n < 1) return "0 B"
  const i = unitOf(n)
  const v = n / 1024 ** i
  return `${v.toFixed(i === 0 ? 0 : (digits ?? (v >= 100 ? 0 : v >= 10 ? 1 : 2)))} ${UNITS[i]}`
}

export function pair(used: number, total: number): string {
  if (used > 0 && total > 0) {
    const i = unitOf(total)
    if (unitOf(used) === i) {
      const size = 1024 ** i
      const f = (n: number) => (n / size).toFixed(i === 0 ? 0 : 2)
      return `${f(used)} / ${f(total)} ${UNITS[i]}`
    }
  }
  return `${bytes(used)} / ${bytes(total)}`
}

export function axisBytes(v: number): string {
  if (!v || v < 0) return "0 B"
  return bytes(v, v / 1024 ** unitOf(v) >= 100 ? 0 : 1).replace(".0 ", " ")
}

export function speed(bps: number): string {
  return `${bytes(bps)}/s`
}

export function percentNum(used: number, total: number): number {
  return total > 0 ? (used / total) * 100 : 0
}

export function uptime(seconds: number): string {
  if (!seconds || seconds < 0 || !Number.isFinite(seconds)) return "—"
  if (seconds < 60) return `${Math.max(1, Math.floor(seconds))} 秒`
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return d > 0 ? `${d} 天 ${h} 小时` : h > 0 ? `${h} 小时 ${m} 分` : `${m} 分`
}

export const FOREVER = "∞"

const MONEY = new Map<string, Intl.NumberFormat>()

function formatMoney(amount: number, currency: string, digits: 0 | 2): string {
  const value = num(amount) ? amount : 0
  try {
    if (!currency || typeof currency !== "string") throw new Error("invalid currency")
    const key = `${currency}:${digits}`
    let format = MONEY.get(key)
    if (!format) {
      format = new Intl.NumberFormat("zh-CN", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits })
      MONEY.set(key, format)
    }
    return format.format(value)
  } catch {
    return `${currency ?? ""} ${value.toFixed(digits)}`.trim()
  }
}


const NAMED_CYCLES: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
  biennial: 24,
  triennial: 36,
  once: 0,
}


/**
 * Billing cycle to months:
 * monthly 1 / quarterly 3 / semiannual 6 / yearly 12 / biennial 24 / triennial 36 / once 0
 * `<n>m` (1–1200) -> n
 * unrecognized -> NaN
 */
export function cycleMonths(cycle?: string | null): number {
  if (!cycle || typeof cycle !== "string") return Number.NaN
  const c = cycle.trim()
  if (Object.prototype.hasOwnProperty.call(NAMED_CYCLES, c)) {
    return NAMED_CYCLES[c]
  }
  const m = /^(\d+)m$/.exec(c)
  if (m) {
    const n = Number(m[1])
    if (Number.isInteger(n) && n >= 1 && n <= 1200) return n
  }
  return Number.NaN
}

const SHORT_CYCLES: Record<number, string> = { 1: "月", 3: "季", 6: "半年", 12: "年", 24: "2年", 36: "3年" }

const SHORT_SYMBOLS = new Map(Object.entries({
  CNY: "¥", USD: "US$", EUR: "€", GBP: "£", JPY: "JP¥", HKD: "HK$",
  SGD: "S$", CAD: "C$", AUD: "A$", TWD: "NT$", KRW: "₩", RUB: "₽",
}))
const wholePrice = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 })
const fractionalPrice = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function cycleSuffix(cycle?: string | null): string {
  const raw = typeof cycle === "string" ? cycle.trim() : ""
  if (!raw) return ""
  const months = cycleMonths(raw)
  if (months === 0) return "/一次性"
  if (!Number.isFinite(months)) return `/${raw}`
  return `/${raw.endsWith("m") ? `${months}月` : SHORT_CYCLES[months]}`
}

export function priceShort(amount: number, currency: string, cycle?: string | null): string {
  const code = currency.trim().toUpperCase()
  const prefix = SHORT_SYMBOLS.get(code) ?? (code ? `${code} ` : "")
  const value = Number.isFinite(amount) ? amount : 0
  const format = Number.isInteger(value) ? wholePrice : fractionalPrice
  return `${prefix}${format.format(value)}${cycleSuffix(cycle)}`
}

// The detail page retains the locale's full currency notation.
export function priceFull(amount: number, currency: string, cycle?: string | null): string {
  return formatMoney(amount, currency, Number.isInteger(amount) ? 0 : 2) + cycleSuffix(cycle)
}


type ExpiryInfo = {
  days: number | null
  text: string
  level: "ok" | "soon" | "expired" | "none"
}

function daysUntil(date?: string | null, nowMs = Date.now()): number | null {
  if (!date || typeof date !== "string") return null
  const raw = date.includes("T") ? date : `${date}T00:00:00`
  const target = new Date(raw).getTime()
  if (Number.isNaN(target)) return null
  return Math.ceil((target - nowMs) / 86_400_000)
}

/**
 * Compute expiry info per SPEC §5.4:
 * - Use `expires_in` when present:
 *   0 = "今天到期", negative = "已过期 N 天", null = don't display
 * - Only when `expires_in` is absent (`undefined`), compute from `expires_at` in the browser.
 * - Level: < 0 -> "expired", 0..7 -> "soon", > 7 -> "ok", null -> "none"
 */
export function expiry(
  node: { expires_in?: number | null; expires_at?: string | null },
  nowMs = Date.now(),
  warnDays = 7,
): ExpiryInfo {
  const hasExpiresIn = "expires_in" in node && node.expires_in !== undefined
  const days = hasExpiresIn
    ? typeof node.expires_in === "number" && Number.isFinite(node.expires_in)
      ? Math.trunc(node.expires_in)
      : null
    : daysUntil(node.expires_at, nowMs)

  if (days === null) {
    return { days: null, text: "", level: "none" }
  }
  if (days < 0) {
    return { days, text: `已过期 ${-days} 天`, level: "expired" }
  }
  const threshold = typeof warnDays === "number" && Number.isFinite(warnDays) && warnDays >= 1 ? warnDays : 7
  if (days === 0) {
    return { days: 0, text: "今天到期", level: "soon" }
  }
  if (days <= threshold) {
    return { days, text: `${days} 天后到期`, level: "soon" }
  }
  return { days, text: `${days} 天后到期`, level: "ok" }
}

/**
 * Offline duration per SPEC §5.3:
 * - Only displayed when offline (`node.online === false`, else returns `null`).
 * - Uses `last_seen_ago` (seconds) when the key is present:
 *   - `null` -> "从未上报"
 *   - number -> formatted duration
 * - When `last_seen_ago` is absent (old Hub), calculate from `last_seen` and `nowMs`:
 *   - `last_seen` is 0 or null/undefined -> "从未上报"
 */
export function offlineFor(
  node: { online?: boolean; last_seen?: number | null; last_seen_ago?: number | null },
  nowMs = Date.now(),
): string | null {
  if (node.online !== false) return null

  const hasAgo = "last_seen_ago" in node && node.last_seen_ago !== undefined
  let seconds: number | null
  if (hasAgo) {
    if (node.last_seen_ago === null) return "从未上报"
    seconds = typeof node.last_seen_ago === "number" && Number.isFinite(node.last_seen_ago) ? Math.max(0, node.last_seen_ago) : null
    if (seconds === null) return "从未上报"
  } else {
    if (!node.last_seen || node.last_seen <= 0) return "从未上报"
    seconds = Math.max(0, Math.floor(nowMs / 1000 - node.last_seen))
  }

  if (seconds < 60) return `${Math.floor(seconds)} 秒`
  return uptime(seconds)
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

let regionDisplayNames: Intl.DisplayNames | null = null

export function regionName(code?: string | null): string {
  if (!code || typeof code !== "string") return ""
  const trimmed = code.trim()
  if (!trimmed) return ""
  const upper = trimmed.toUpperCase()
  try {
    if (!regionDisplayNames && typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function") {
      regionDisplayNames = new Intl.DisplayNames("zh-CN", { type: "region" })
    }
    const name = regionDisplayNames?.of(upper)
    if (name && name.toUpperCase() !== upper) {
      return name.replace(/^中国/, "").replace(/特别行政区$/, "") || name
    }
  } catch {
    // ignore
  }
  return code
}

export function monthUsage(n: Node) {
  const rx = n.month_rx ?? n.metrics?.month_rx ?? 0, tx = n.month_tx ?? n.metrics?.month_tx ?? 0
  return n.month_used ?? (n.traffic_mode === 'up' ? tx : n.traffic_mode === 'down' ? rx : n.traffic_mode === 'max' ? Math.max(rx, tx) : rx + tx)
}
