import { describe, expect, it } from "vitest";
import { calculatePersonalTax } from "@/lib/tax/personal-tax";

/**
 * NZ individual income tax — bracket math.
 * 2026 brackets (annual): 15600 / 53500 / 78100 / 180000 / Infinity
 *                rates:    10.5%  / 17.5%  / 30%   / 33%    / 39%
 */

describe("calculatePersonalTax (2026)", () => {
  const TY = 2026;

  it("zero income → zero tax", () => {
    const r = calculatePersonalTax(0, TY);
    expect(r.totalTax).toBe(0);
    expect(r.effectiveRate).toBe(0);
  });

  it("negative income clamps to zero", () => {
    expect(calculatePersonalTax(-1000, TY).totalTax).toBe(0);
  });

  it("$15,600 (top of band 1) → $1,638", () => {
    expect(calculatePersonalTax(15600, TY).totalTax).toBe(1638);
  });

  it("$50,000 (mid band 2) → $7,658", () => {
    // 15,600 × 0.105 + (50,000 - 15,600) × 0.175
    // = 1,638 + 34,400 × 0.175 = 1,638 + 6,020 = $7,658
    expect(calculatePersonalTax(50000, TY).totalTax).toBe(7658);
  });

  it("$80,000 spans bands 1-4", () => {
    // band 1: 15,600 × 0.105 = 1,638
    // band 2: (53,500 - 15,600) × 0.175 = 6,632.50
    // band 3: (78,100 - 53,500) × 0.30 = 7,380
    // band 4 partial: (80,000 - 78,100) × 0.33 = 627
    // Total: 1,638 + 6,632.50 + 7,380 + 627 = 16,277.50
    expect(calculatePersonalTax(80000, TY).totalTax).toBe(16277.5);
  });

  it("$200,000 hits all 5 brackets including top 39%", () => {
    // band 1: 1,638
    // band 2: 6,632.50
    // band 3: (78,100 - 53,500) × 0.30 = 7,380
    // band 4: (180,000 - 78,100) × 0.33 = 33,627
    // band 5: (200,000 - 180,000) × 0.39 = 7,800
    // Total: 1,638 + 6,632.50 + 7,380 + 33,627 + 7,800 = 57,077.50
    expect(calculatePersonalTax(200000, TY).totalTax).toBe(57077.5);
  });

  it("returns per-bracket breakdown", () => {
    const r = calculatePersonalTax(50000, TY);
    expect(r.bracketBreakdown).toHaveLength(2);
    expect(r.bracketBreakdown[0]).toMatchObject({ rate: 0.105, taxableAmount: 15600, tax: 1638 });
    expect(r.bracketBreakdown[1]).toMatchObject({ rate: 0.175, taxableAmount: 34400 });
  });

  it("effective rate climbs with income", () => {
    const r1 = calculatePersonalTax(20000, TY);
    const r2 = calculatePersonalTax(100000, TY);
    expect(r2.effectiveRate).toBeGreaterThan(r1.effectiveRate);
  });
});
