import { describe, expect, it } from "vitest";
import { calculateEsct } from "@/lib/payroll/calculator";

/**
 * ESCT bracket selection by employee's annual earnings.
 * 2026 brackets:
 *   ≤ 18,720 → 10.5%
 *   ≤ 64,200 → 17.5%
 *   ≤ 93,720 → 30%
 *   ≤ 216,000 → 33%
 *   > 216,000 → 39%
 *
 * Note: brackets compare against ANNUAL EARNINGS, then the rate is applied to
 * the per-period EMPLOYER CONTRIBUTION (not the earnings).
 */

describe("calculateEsct (2026)", () => {
  const TY = 2026;

  it("zero employer contribution → zero ESCT", () => {
    expect(calculateEsct(0, 50000, TY)).toBe(0);
  });

  it("low-income employee ($15,000) uses 10.5%", () => {
    // Employer contribution $30 × 10.5% = $3.15
    expect(calculateEsct(30, 15000, TY)).toBe(3.15);
  });

  it("at $18,720 boundary → 10.5% (≤)", () => {
    expect(calculateEsct(100, 18720, TY)).toBe(10.5);
  });

  it("$18,721 → next band 17.5%", () => {
    expect(calculateEsct(100, 18721, TY)).toBe(17.5);
  });

  it("middle income $50,000 → 17.5%", () => {
    expect(calculateEsct(100, 50000, TY)).toBe(17.5);
  });

  it("at $64,200 boundary → 17.5%", () => {
    expect(calculateEsct(100, 64200, TY)).toBe(17.5);
  });

  it("$70,000 → 30%", () => {
    expect(calculateEsct(100, 70000, TY)).toBe(30);
  });

  it("$100,000 → 33%", () => {
    expect(calculateEsct(100, 100000, TY)).toBe(33);
  });

  it("$300,000 → top band 39%", () => {
    expect(calculateEsct(100, 300000, TY)).toBe(39);
  });

  it("rounds to two decimal places", () => {
    // 33.333 × 17.5% = 5.83328... → 5.83
    expect(calculateEsct(33.333, 50000, TY)).toBe(5.83);
  });
});
