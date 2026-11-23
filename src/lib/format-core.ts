/** Derived in part from monitor-theme-default (MIT, Copyright (c) 2026 stqfdyr). */
import { num } from "./api"

export const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"]

export const unitOf = (n: number) => {
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
function cycleMonths(cycle?: string | null): number {
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

export function cycleSuffix(cycle?: string | null): string {
  const raw = typeof cycle === "string" ? cycle.trim() : ""
  if (!raw) return ""
  const months = cycleMonths(raw)
  if (months === 0) return "/一次性"
  if (!Number.isFinite(months)) return `/${raw}`
  return `/${raw.endsWith("m") ? `${months}月` : SHORT_CYCLES[months]}`
}

