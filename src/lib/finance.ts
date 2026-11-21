import { cycleMonths } from "@/lib/format"

export type FinanceNodeInput = {
  price?: number | null
  currency?: string | null
  billing_cycle?: string | null
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
