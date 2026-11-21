import { describe, expect, it } from "vitest"
import { monthlyCost } from "@/lib/finance"

const paid = { price: 120, billing_cycle: "monthly", currency: "CNY" }

describe("monthlyCost", () => {
  it.each([
    ["monthly", 120], ["quarterly", 40], ["semiannual", 20], ["yearly", 10],
    ["biennial", 5], ["triennial", 120 / 36], ["60m", 2],
  ] as const)("normalizes %s to its monthly cost", (billing_cycle, expected) => {
    expect(monthlyCost({ ...paid, billing_cycle })).toBeCloseTo(expected, 10)
  })

  it.each(["once", "0m", "1201m", "not-a-cycle"])("does not estimate a monthly cost for %s", (billing_cycle) => {
    expect(monthlyCost({ ...paid, billing_cycle })).toBeNull()
  })

  it.each([0, -1, NaN])("returns null for invalid/non-positive price %s", (price) => {
    expect(monthlyCost({ ...paid, price })).toBeNull()
  })
})
