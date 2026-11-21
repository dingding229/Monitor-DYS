/**
 * Derived in part from monitor-theme-default (MIT, Copyright (c) 2026 stqfdyr).
 */

const WINDOWS = [1, 6, 24, 168, 720, 2160]

/**
 * Generate range hours array from history_days.
 * Per SPEC §5.8:
 * - Presets `[1, 6, 24, 168, 720, 2160]` hours
 * - Remove any exceeding `history_days * 24`
 * - Remove any preset within 25% of the limit (`h * 1.25 > whole`)
 * - Append the limit itself (`history_days * 24`)
 */
export function rangesFor(historyDays?: number | null): number[] {
  const days = typeof historyDays === "number" && Number.isFinite(historyDays) && historyDays >= 1 ? Math.floor(historyDays) : 7
  const whole = Math.min(365, Math.max(1, days)) * 24
  const presets = WINDOWS.filter((h) => h * 1.25 <= whole)
  return [...presets, whole]
}

export function rangeLabel(hours: number): string {
  if (hours < 24) return `${hours} 小时`
  if (hours === 8760) return "1 年"
  const days = hours / 24
  return Number.isInteger(days) ? `${days} 天` : `${hours} 小时`
}
