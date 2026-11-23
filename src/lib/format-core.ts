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

const CYCLE_LABELS: Record<string, string> = {
  monthly: "月", quarterly: "季", semiannual: "半年", yearly: "年",
  biennial: "2年", triennial: "3年", once: "一次性",
}

export function cycleSuffix(cycle?: string | null): string {
  const raw = typeof cycle === "string" ? cycle.trim() : ""
  if (!raw) return ""
  if (Object.hasOwn(CYCLE_LABELS, raw)) return `/${CYCLE_LABELS[raw]}`
  const months = Number(/^(\d+)m$/.exec(raw)?.[1])
  return `/${months >= 1 && months <= 1200 ? `${months}月` : raw}`
}
