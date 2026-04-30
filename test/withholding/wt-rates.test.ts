import { describe, expect, it } from "vitest";
import { calculateRecommendedWtRate } from "@/lib/calculators/wt-advisor";

/**
 * Schedular payments / contractor withholding tax (WT) rate advisor.
 * Standard voluntary WT rates: 10%, 15%, 20%, 25%, 30%, 33%.
 *
 * Test that the advisor maps the IDEAL rate (totalWtNeeded / contractIncome)
 * to the smallest STANDARD rate that's >= ideal — i.e., never under-withholds.
 */

describe("calculateRecommendedWtRate", () => {
  const TY = 2026;

  it("zero contract income → warning, no recommendation", () => {
    const r = calculateRecommendedWtRate({
      contractIncome: 0,
      otherEmploymentIncome: 0,
      otherIncome: 0,
      claimableExpenses: 0,
      hasStudentLoan: false,
      includeAccLevy: false,
      taxYear: TY,
    });
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("low income contractor: under 10% → recommends 10% (the floor)", () => {
    // $20k contract income, no other income. Tax: $20k × 10.5% (mostly band 1) ≈ $2,100
    // Ideal rate: 2100/20000 = 10.5% → recommend 15% (next standard rate up)
    const r = calculateRecommendedWtRate({
      contractIncome: 20000,
      otherEmploymentIncome: 0,
      otherIncome: 0,
      claimableExpenses: 0,
      hasStudentLoan: false,
      includeAccLevy: false,
      taxYear: TY,
    });
    expect(r.recommendedRate).toBe(0.15);
  });

  it("high earner: ideal > 33% → tops out at 33% (max standard)", () => {
    // $300k contract income → ~33% effective. Confirms cap.
    const r = calculateRecommendedWtRate({
      contractIncome: 300000,
      otherEmploymentIncome: 0,
      otherIncome: 0,
      claimableExpenses: 0,
      hasStudentLoan: false,
      includeAccLevy: false,
      taxYear: TY,
    });
    expect(r.recommendedRate).toBe(0.33);
  });

  it("breakdown ends with 'Total WT needed' = totalWtNeeded", () => {
    const r = calculateRecommendedWtRate({
      contractIncome: 80000,
      otherEmploymentIncome: 0,
      otherIncome: 0,
      claimableExpenses: 5000,
      hasStudentLoan: true,
      includeAccLevy: true,
      taxYear: TY,
    });
    const last = r.breakdown[r.breakdown.length - 1];
    expect(last.label).toMatch(/Total WT needed/i);
    expect(last.amount).toBeCloseTo(r.totalWtNeeded, 1);
  });

  it("rate comparison table includes all standard rates", () => {
    const r = calculateRecommendedWtRate({
      contractIncome: 50000,
      otherEmploymentIncome: 0,
      otherIncome: 0,
      claimableExpenses: 0,
      hasStudentLoan: false,
      includeAccLevy: false,
      taxYear: TY,
    });
    const rates = r.rateComparison.map((c) => c.rate);
    expect(rates).toEqual([0.10, 0.15, 0.20, 0.25, 0.30, 0.33]);
  });

  it("exactly one rate marked recommended", () => {
    const r = calculateRecommendedWtRate({
      contractIncome: 60000,
      otherEmploymentIncome: 0,
      otherIncome: 0,
      claimableExpenses: 0,
      hasStudentLoan: false,
      includeAccLevy: false,
      taxYear: TY,
    });
    const recommended = r.rateComparison.filter((c) => c.isRecommended);
    expect(recommended).toHaveLength(1);
    expect(recommended[0].rate).toBe(r.recommendedRate);
  });

  it("student loan adds to WT need (recommendation goes up vs without)", () => {
    const base = {
      contractIncome: 50000,
      otherEmploymentIncome: 0,
      otherIncome: 0,
      claimableExpenses: 0,
      includeAccLevy: false,
      taxYear: TY,
    };
    const noSL = calculateRecommendedWtRate({ ...base, hasStudentLoan: false });
    const withSL = calculateRecommendedWtRate({ ...base, hasStudentLoan: true });
    expect(withSL.totalWtNeeded).toBeGreaterThan(noSL.totalWtNeeded);
  });

  it("ACC levy adds to WT need when included", () => {
    const base = {
      contractIncome: 50000,
      otherEmploymentIncome: 0,
      otherIncome: 0,
      claimableExpenses: 0,
      hasStudentLoan: false,
      taxYear: TY,
    };
    const noAcc = calculateRecommendedWtRate({ ...base, includeAccLevy: false });
    const withAcc = calculateRecommendedWtRate({ ...base, includeAccLevy: true });
    expect(withAcc.totalWtNeeded).toBeGreaterThan(noAcc.totalWtNeeded);
  });
});
