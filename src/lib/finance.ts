/**
 * Financial & remaining value pure functions per SPEC-v1.1 §E.
 */
import { cycleMonths, daysUntil } from "@/lib/format"

export type FinanceNodeInput = {
  price?: number | null
  currency?: string | null
  billing_cycle?: string | null
  expires_in?: number | null
  expires_at?: string | null
}

/**
 * `price / cycleMonths(billing_cycle)`; returns null for `once` (0), NaN, or price <= 0.
 */
export function monthlyCost(node: FinanceNodeInput | null | undefined): number | null {
  if (!node) return null
  const price = node.price
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return null
  const months = cycleMonths(node.billing_cycle)
  if (!Number.isFinite(months) || months <= 0) return null
  return price / months
}

function resolveExpiresIn(node: FinanceNodeInput): number | null {
  if ("expires_in" in node && node.expires_in !== undefined) {
    return typeof node.expires_in === "number" && Number.isFinite(node.expires_in) ? node.expires_in : null
  }
  return daysUntil(node.expires_at)
}

/**
 * Requires `expires_in > 0` and `monthlyCost(node) !== null`.
 * Result is `monthlyCost * expires_in / 30.4375`.
 * Returns null for `once` or when requirements are not met.
 */
export function remainingValue(node: FinanceNodeInput | null | undefined): number | null {
  if (!node) return null
  const monthly = monthlyCost(node)
  if (monthly === null) return null
  const days = resolveExpiresIn(node)
  if (typeof days !== "number" || !Number.isFinite(days) || days <= 0) return null
  return (monthly * days) / 30.4375
}

export type ValueSummary = {
  amount: number
  counted: number
  skipped: number
}

/**
 * Accumulates remaining value only for nodes whose `currency` matches target `currency` (case-insensitive).
 * Other nodes that have a non-null remainingValue are counted in `skipped`.
 */
export function summarizeValue(nodes: FinanceNodeInput[], currency = "CNY"): ValueSummary {
  const target = (currency || "CNY").trim().toUpperCase()
  let amount = 0
  let counted = 0
  let skipped = 0

  if (!Array.isArray(nodes)) return { amount: 0, counted: 0, skipped: 0 }

  for (const node of nodes) {
    const val = remainingValue(node)
    if (val === null) continue
    const nodeCurr = (node.currency || "").trim().toUpperCase()
    if (nodeCurr === target) {
      amount += val
      counted++
    } else {
      skipped++
    }
  }

  return { amount, counted, skipped }
}
