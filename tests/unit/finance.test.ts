import { describe, expect, it } from "vitest"
import { monthlyCost, remainingValue, summarizeValue } from "@/lib/finance"

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

describe("remainingValue", () => {
  it("uses the normalized monthly cost and 30.4375 days per month", () => {
    expect(remainingValue({ ...paid, billing_cycle: "quarterly", expires_in: 15 })).toBeCloseTo(40 * 15 / 30.4375, 10)
  })

  it.each([0, -3, null])("returns null for expires_in %s", (expires_in) => {
    expect(remainingValue({ ...paid, expires_in })).toBeNull()
  })

  it("returns null when the node has no expiry keys", () => {
    expect(remainingValue(paid)).toBeNull()
  })

  it("does not replace an explicitly null expires_in with expires_at", () => {
    expect(remainingValue({ ...paid, expires_in: null, expires_at: "2099-01-01" })).toBeNull()
  })

  it("does not assign remaining value to a one-time payment or a zero-price plan", () => {
    expect(remainingValue({ ...paid, billing_cycle: "once", expires_in: 30 })).toBeNull()
    expect(remainingValue({ ...paid, price: 0, expires_in: 30 })).toBeNull()
  })
})

describe("summarizeValue", () => {
  const nodes = [
    { ...paid, expires_in: 3 },
    { ...paid, price: 60, billing_cycle: "quarterly", expires_in: 20 },
    { ...paid, currency: "USD", expires_in: 30 },
    { ...paid, currency: "EUR", expires_in: 60 },
    { ...paid, currency: "HKD", billing_cycle: "once", expires_in: 30 },
    { ...paid, currency: "JPY", expires_in: -3 },
  ]

  it("sums only the requested currency, skipping only other currencies with estimable value", () => {
    const cny = summarizeValue(nodes, "CNY")
    expect(cny).toMatchObject({ counted: 2, skipped: 2 })
    expect(cny.amount).toBeCloseTo((120 * 3 + 20 * 20) / 30.4375, 10)
    const usd = summarizeValue(nodes, "USD")
    expect(usd).toMatchObject({ counted: 1, skipped: 3 })
    expect(usd.amount).toBeCloseTo(120 * 30 / 30.4375, 10)
  })

  it("does not convert currencies when no node matches; empty input has no skipped nodes", () => {
    expect(summarizeValue(nodes, "JPY")).toEqual({ amount: 0, counted: 0, skipped: 4 })
    expect(summarizeValue([], "CNY")).toEqual({ amount: 0, counted: 0, skipped: 0 })
  })
})
