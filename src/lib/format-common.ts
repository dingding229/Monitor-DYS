/**
 * Derived in part from monitor-theme-default (MIT, Copyright (c) 2026 stqfdyr).
 */

import { num, type Node } from "./api"
import { bytes, cycleSuffix, unitOf, UNITS } from "./format-core"
export { bytes } from "./format-core"

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

const SHORT_SYMBOLS = new Map(Object.entries({
  CNY: "¥", USD: "US$", EUR: "€", GBP: "£", JPY: "JP¥", HKD: "HK$",
  SGD: "S$", CAD: "C$", AUD: "A$", TWD: "NT$", KRW: "₩", RUB: "₽",
}))
const wholePrice = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 })
const fractionalPrice = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function priceShort(amount: number, currency: string, cycle?: string | null): string {
  const code = currency.trim().toUpperCase()
  const prefix = SHORT_SYMBOLS.get(code) ?? (code ? `${code} ` : "")
  const value = Number.isFinite(amount) ? amount : 0
  const format = Number.isInteger(value) ? wholePrice : fractionalPrice
  return `${prefix}${format.format(value)}${cycleSuffix(cycle)}`
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
  const remaining = node.expires_in
  const days = remaining === undefined ? daysUntil(node.expires_at, nowMs) : num(remaining) ? Math.trunc(remaining) : null

  if (days === null) {
    return { days: null, text: "", level: "none" }
  }
  if (days < 0) {
    return { days, text: `已过期 ${-days} 天`, level: "expired" }
  }
  if (days === 0) return { days: 0, text: "今天到期", level: "soon" }
  const threshold = num(warnDays) && warnDays >= 1 ? warnDays : 7
  return { days, text: `${days} 天后到期`, level: days <= threshold ? "soon" : "ok" }
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

  const ago = node.last_seen_ago
  const seconds = ago !== undefined
    ? num(ago) ? Math.max(0, ago) : null
    : !node.last_seen || node.last_seen <= 0 ? null : Math.max(0, Math.floor(nowMs / 1000 - node.last_seen))
  return seconds === null ? "从未上报" : seconds < 60 ? `${Math.floor(seconds)} 秒` : uptime(seconds)
}


let regionDisplayNames: Intl.DisplayNames | null = null

export function regionName(code?: string | null): string {
  if (typeof code !== "string") return ""
  const upper = code.trim().toUpperCase()
  if (!upper) return ""
  try {
    const name = (regionDisplayNames ??= new Intl.DisplayNames("zh-CN", { type: "region" })).of(upper)
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
