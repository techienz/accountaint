import { describe, expect, it } from "vitest";
import { estimateACCLevy } from "@/lib/calculators/acc";
import { getTaxYearConfig } from "@/lib/tax/rules";

/**
 * ACC earner levy is rate-per-$100 of liable earnings, capped at the annual
 * earnings cap. Levy rates are reviewed annually by ACC.
 *
 * 2026: rate 1.67 per $100, cap $152,790
 */

describe("estimateACCLevy", () => {
  it("zero earnings → zero levy", () => {
    expect(estimateACCLevy(0, 1.67).estimatedLevy).toBe(0);
  });

  it("$100 at rate 1.67 → $1.67", () => {
    expect(estimateACCLevy(100, 1.67).estimatedLevy).toBe(1.67);
  });

  it("$1,000 at rate 1.67 → $16.70", () => {
    expect(estimateACCLevy(1000, 1.67).estimatedLevy).toBe(16.7);
  });

  it("$50,000 at rate 1.67 → $835", () => {
    expect(estimateACCLevy(50000, 1.67).estimatedLevy).toBe(835);
  });

  it("rounds to two decimal places", () => {
    // 1234.56 / 100 × 1.67 = 20.6171... → 20.62
    expect(estimateACCLevy(1234.56, 1.67).estimatedLevy).toBe(20.62);
  });

  it("returns input + rate verbatim alongside the levy", () => {
    const result = estimateACCLevy(50000, 1.67);
    expect(result.liableEarnings).toBe(50000);
    expect(result.levyRate).toBe(1.67);
  });

  it("uses 2026 rate from config (lock against config drift)", () => {
    const config = getTaxYearConfig(2026);
    expect(config.accEarnerLevyRate).toBe(1.67);
    expect(config.accEarnerLevyCap).toBe(152790);
  });
});
