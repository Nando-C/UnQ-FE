import { describe, it, expect } from "vitest"
import { formatPrice } from "../lib/price"

describe("formatPrice", () => {
  it("always shows pence, with the symbol attached", () => {
    expect(formatPrice(9.5)).toBe("£9.50")
    expect(formatPrice(12)).toBe("£12.00")
    expect(formatPrice(0)).toBe("£0.00")
  })

  it("rounds away floating-point noise from summed totals", () => {
    expect(formatPrice(0.1 + 0.2)).toBe("£0.30")
    expect(formatPrice(4.5 * 3 - 0.0000001)).toBe("£13.50")
  })

  it("groups thousands", () => {
    expect(formatPrice(1234.5)).toBe("£1,234.50")
  })

  it("treats a missing price as zero rather than printing NaN", () => {
    expect(formatPrice(undefined)).toBe("£0.00")
    expect(formatPrice(null)).toBe("£0.00")
  })
})
