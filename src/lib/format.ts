/**
 * Derived in part from monitor-theme-default (MIT, Copyright (c) 2026 stqfdyr).
 */

const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"]

const unitOf = (n: number) => Math.min(Math.floor(Math.log(n) / Math.log(1024)), UNITS.length - 1)

export function bytes(n: number, digits?: number): string {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 1) return "0 B"
  const i = unitOf(n)
  const v = n / 1024 ** i
  return `${v.toFixed(i === 0 ? 0 : (digits ?? (v >= 100 ? 0 : v >= 10 ? 1 : 2)))} ${UNITS[i]}`
}

export function pair(used: number, total: number): string {
  if (used > 0 && total > 0 && unitOf(used) === unitOf(total)) {
    const i = unitOf(total)
    const f = (n: number) => (n / 1024 ** i).toFixed(i === 0 ? 0 : 2)
    return `${f(used)} / ${f(total)} ${UNITS[i]}`
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

export const rate = speed

export function percent(x: number, total?: number): string {
  if (typeof total === "number") {
    if (!(total > 0) || !Number.isFinite(x)) return "0%"
    const p = Math.max(0, (x / total) * 100)
    return `${p < 10 && p > 0 ? p.toFixed(1) : Math.round(p)}%`
  }
  if (typeof x !== "number" || !Number.isFinite(x)) return "0%"
  const clamped = Math.max(0, x)
  return `${clamped < 10 && clamped > 0 && !Number.isInteger(clamped) ? clamped.toFixed(1) : Math.round(clamped)}%`
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

export function money(amount: number, currency: string): string {
  const num = typeof amount === "number" && Number.isFinite(amount) ? amount : 0
  try {
    if (!currency || typeof currency !== "string") throw new Error("invalid currency")
    let format = MONEY.get(currency)
    if (!format) {
      format = new Intl.NumberFormat("zh-CN", { style: "currency", currency, maximumFractionDigits: 2 })
      MONEY.set(currency, format)
    }
    return format.format(num)
  } catch {
    return `${currency ?? ""} ${num.toFixed(2)}`.trim()
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

const CYCLE_WORDS: Record<number, string> = {
  0: "一次性",
  1: "月付",
  3: "季付",
  6: "半年付",
  12: "年付",
  24: "两年付",
  36: "三年付",
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

export function cycleLabel(cycle?: string | null): string {
  const m = cycleMonths(cycle)
  if (Number.isNaN(m)) return cycle || ""
  if (CYCLE_WORDS[m]) return CYCLE_WORDS[m]
  return m % 12 === 0 ? `${m / 12} 年付` : `${m} 个月付`
}

export type ExpiryInfo = {
  days: number | null
  text: string
  level: "ok" | "soon" | "expired" | "none"
}

export function daysUntil(date?: string | null, nowMs = Date.now()): number | null {
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

export function osName(name?: string | null): string {
  if (!name) return ""
  return name.replace("GNU/Linux ", "").replace(/\s*\([^)]*\)\s*$/, "")
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
