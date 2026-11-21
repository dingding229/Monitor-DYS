import { describe, expect, it } from "vitest"
import { withAlpha } from "@/lib/color"

describe("withAlpha", () => {
  it("resolves 6-digit hex colors (#2563eb)", () => {
    expect(withAlpha("#2563eb", 0.1)).toBe("rgba(37, 99, 235, 0.1)")
    expect(withAlpha("#2563EB", 0.25)).toBe("rgba(37, 99, 235, 0.25)")
  })

  it("resolves 3-digit hex colors (#abc)", () => {
    expect(withAlpha("#abc", 0.2)).toBe("rgba(170, 187, 204, 0.2)")
  })

  it("resolves named CSS colors (rebeccapurple)", () => {
    expect(withAlpha("rebeccapurple", 0.15)).toBe("rgba(102, 51, 153, 0.15)")
  })

  it("resolves rgb(...) and rgba(...) colors", () => {
    expect(withAlpha("rgb(1, 2, 3)", 0.5)).toBe("rgba(1, 2, 3, 0.5)")
    expect(withAlpha("rgb(1,2,3)", 0.1)).toBe("rgba(1, 2, 3, 0.1)")
    expect(withAlpha("rgba(10, 20, 30, 0.8)", 0.2)).toBe("rgba(10, 20, 30, 0.2)")
  })

  it("falls back to default #10b981 on invalid color values", () => {
    expect(withAlpha("notacolor", 0.1)).toBe("rgba(16, 185, 129, 0.1)")
    expect(withAlpha("", 0.1)).toBe("rgba(16, 185, 129, 0.1)")
    expect(withAlpha("#zzzzzz", 0.1)).toBe("rgba(16, 185, 129, 0.1)")
    expect(withAlpha("rgb(bad)", 0.1)).toBe("rgba(16, 185, 129, 0.1)")
  })

  it("clamps alpha into [0, 1]", () => {
    expect(withAlpha("#2563eb", -0.5)).toBe("rgba(37, 99, 235, 0)")
    expect(withAlpha("#2563eb", 2)).toBe("rgba(37, 99, 235, 1)")
  })
})
