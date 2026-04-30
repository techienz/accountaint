import { describe, expect, it } from "vitest";
import { calculateAnnualDepreciation, calculateDisposal } from "@/lib/tax/depreciation";

describe("calculateAnnualDepreciation — DV method", () => {
  it("standard 12-month year at 10% on $10,000 opening", () => {
    const r = calculateAnnualDepreciation(10000, 10000, "DV", 0.10, 12);
    expect(r.depreciationAmount).toBe(1000);
    expect(r.closingBookValue).toBe(9000);
  });

  it("pro-rates by months owned (6 months → half)", () => {
    const r = calculateAnnualDepreciation(10000, 10000, "DV", 0.10, 6);
    expect(r.depreciationAmount).toBe(500);
    expect(r.closingBookValue).toBe(9500);
  });

  it("pro-rates 1 month at 10% rate → $83.33", () => {
    // 10000 × 0.10 × 1/12 = 83.333... → 83.33
    const r = calculateAnnualDepreciation(10000, 10000, "DV", 0.10, 1);
    expect(r.depreciationAmount).toBe(83.33);
  });

  it("DV rate applied to OPENING BOOK VALUE not cost (year 2 example)", () => {
    // Year 1: 10,000 → 9,000 (DV @ 10%)
    // Year 2: 9,000 × 0.10 = 900
    const r = calculateAnnualDepreciation(10000, 9000, "DV", 0.10, 12);
    expect(r.depreciationAmount).toBe(900);
    expect(r.closingBookValue).toBe(8100);
  });

  it("cannot depreciate below zero", () => {
    const r = calculateAnnualDepreciation(10000, 100, "DV", 0.50, 12);
    // 100 × 0.50 = 50, but capped at opening book value 100 (so depreciates 50, not all of book value)
    // Actually 50 ≤ 100 so cap doesn't kick in
    expect(r.depreciationAmount).toBe(50);
    expect(r.closingBookValue).toBe(50);
  });

  it("caps depreciation at opening book value", () => {
    // 100 × 2.0 (200%) = 200, capped at 100
    const r = calculateAnnualDepreciation(10000, 100, "DV", 2.0, 12);
    expect(r.depreciationAmount).toBe(100);
    expect(r.closingBookValue).toBe(0);
  });

  it("12+ months caps at full year (no extra)", () => {
    const fullYear = calculateAnnualDepreciation(10000, 10000, "DV", 0.10, 12);
    const overYear = calculateAnnualDepreciation(10000, 10000, "DV", 0.10, 24);
    expect(overYear.depreciationAmount).toBe(fullYear.depreciationAmount);
  });
});

describe("calculateAnnualDepreciation — SL method", () => {
  it("straight-line at 10% on $10,000 cost = $1,000/year regardless of book value", () => {
    const r = calculateAnnualDepreciation(10000, 10000, "SL", 0.10, 12);
    expect(r.depreciationAmount).toBe(1000);
    expect(r.closingBookValue).toBe(9000);
  });

  it("year 5 SL: cost=10,000, book=6,000 → still 1,000/year (cost-based)", () => {
    const r = calculateAnnualDepreciation(10000, 6000, "SL", 0.10, 12);
    expect(r.depreciationAmount).toBe(1000);
    expect(r.closingBookValue).toBe(5000);
  });

  it("pro-rates by months owned", () => {
    const r = calculateAnnualDepreciation(10000, 10000, "SL", 0.10, 3);
    expect(r.depreciationAmount).toBe(250); // 1000 × 3/12
  });
});

describe("calculateDisposal", () => {
  it("sale equal to book value → no recovery, no loss", () => {
    const r = calculateDisposal(10000, 6000, 6000);
    expect(r.depreciationRecovered).toBe(0);
    expect(r.lossOnSale).toBe(0);
  });

  it("sale above book value → recovery (capped at cost)", () => {
    // book 6000, sold 8000 → recover 2000
    const r = calculateDisposal(10000, 6000, 8000);
    expect(r.depreciationRecovered).toBe(2000);
    expect(r.lossOnSale).toBe(0);
  });

  it("sale above original cost → recovery capped at cost", () => {
    // book 6000, sold 12000 (above 10000 cost). Recovery capped: cost - book = 4000 (not 6000)
    const r = calculateDisposal(10000, 6000, 12000);
    expect(r.depreciationRecovered).toBe(4000);
  });

  it("sale below book value → loss on sale", () => {
    const r = calculateDisposal(10000, 6000, 4000);
    expect(r.depreciationRecovered).toBe(0);
    expect(r.lossOnSale).toBe(2000);
  });
});
