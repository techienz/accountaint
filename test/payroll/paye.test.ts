import { describe, expect, it } from "vitest";
import { calculatePaye, calculatePayeIncomeTax, calculatePayeAccLevy } from "@/lib/payroll/calculator";
import { getTaxYearConfig } from "@/lib/tax/rules";

/**
 * PAYE calculation tests.
 *
 * AFTER audit finding #65 (2026-05-01): calculatePaye returns the COMBINED
 * IRD-style figure = income tax + ACC earner levy. The bracket-math-only
 * function is exposed as calculatePayeIncomeTax.
 *
 * - Bracket math tests use calculatePayeIncomeTax (rate-derived).
 * - The combined-PAYE tests below use the IRD PAYE calculator as the
 *   source of truth (IRD-published-example).
 */

describe("calculatePayeIncomeTax — bracket math (rate-derived)", () => {
  const TY = 2026;
  const config = getTaxYearConfig(TY);

  it("zero income → zero", () => {
    expect(calculatePayeIncomeTax(0, "weekly", "M", TY)).toBe(0);
  });

  it("$100/week stays in lowest band (10.5%) → $10.50", () => {
    expect(calculatePayeIncomeTax(100, "weekly", "M", TY)).toBe(10.5);
  });

  it("annualised $40k spans bracket 1+2", () => {
    const expected = (15600 * 0.105 + (40000 - 15600) * 0.175) / 52;
    expect(calculatePayeIncomeTax(40000 / 52, "weekly", "M", TY)).toBeCloseTo(expected, 1);
  });

  it("annualised $200k spans all 5 brackets", () => {
    const annual =
      15600 * 0.105 +
      (53500 - 15600) * 0.175 +
      (78100 - 53500) * 0.30 +
      (180000 - 78100) * 0.33 +
      (200000 - 180000) * 0.39;
    expect(calculatePayeIncomeTax(200000 / 52, "weekly", "M", TY)).toBeCloseTo(annual / 52, 1);
  });

  it("personal income tax brackets in config match expected values for tax year 2026", () => {
    expect(config.personalIncomeTaxBrackets).toEqual([
      { threshold: 15600, rate: 0.105 },
      { threshold: 53500, rate: 0.175 },
      { threshold: 78100, rate: 0.30 },
      { threshold: 180000, rate: 0.33 },
      { threshold: Infinity, rate: 0.39 },
    ]);
  });
});

describe("calculatePayeIncomeTax — secondary tax codes (rate-derived)", () => {
  const TY = 2026;
  it("SB applies 10.5% flat", () => expect(calculatePayeIncomeTax(1000, "weekly", "SB", TY)).toBe(105.0));
  it("S applies 17.5% flat", () => expect(calculatePayeIncomeTax(1000, "weekly", "S", TY)).toBe(175.0));
  it("SH applies 30% flat", () => expect(calculatePayeIncomeTax(1000, "weekly", "SH", TY)).toBe(300.0));
  it("ST applies 33% flat", () => expect(calculatePayeIncomeTax(1000, "weekly", "ST", TY)).toBe(330.0));
  it("SA applies 39% flat", () => expect(calculatePayeIncomeTax(1000, "weekly", "SA", TY)).toBe(390.0));
  it("ND applies 45% flat", () => expect(calculatePayeIncomeTax(1000, "weekly", "ND", TY)).toBe(450.0));
  it("SL suffix doesn't change income tax", () => {
    expect(calculatePayeIncomeTax(1000, "weekly", "SB SL", TY)).toBe(105.0);
  });
});

describe("calculatePayeAccLevy — earner levy with cap (2026)", () => {
  const TY = 2026;

  it("zero gross → zero levy", () => {
    expect(calculatePayeAccLevy(0, "weekly", TY)).toBe(0);
  });

  it("$1000/week (annualised $52k, well under cap) → $16.70", () => {
    // 1000 × 1.67/100 = 16.70
    expect(calculatePayeAccLevy(1000, "weekly", TY)).toBe(16.7);
  });

  it("$2000/fortnight (annualised $52k, well under cap) → $33.40", () => {
    // 2000 × 1.67/100 = 33.40
    expect(calculatePayeAccLevy(2000, "fortnightly", TY)).toBe(33.4);
  });

  it("at exactly the cap ($152,790/year), full rate applies", () => {
    // 152,790 / 52 = 2938.27 weekly, all liable
    const grossWeekly = 152790 / 52;
    const expected = (grossWeekly / 100) * 1.67;
    expect(calculatePayeAccLevy(grossWeekly, "weekly", TY)).toBeCloseTo(expected, 2);
  });

  it("above the cap ($200k/year), capped at cap-divided-by-factor", () => {
    // 200k/52 = $3846.15 gross weekly. Annualised exceeds cap.
    // Per-period liable = 152,790 / 52 = $2938.27
    // Levy = 2938.27 × 1.67 / 100 = 49.07
    const expectedCappedWeekly = (152790 / 52 / 100) * 1.67;
    expect(calculatePayeAccLevy(200000 / 52, "weekly", TY)).toBeCloseTo(expectedCappedWeekly, 2);
  });
});

describe("calculatePaye — COMBINED IRD figure (IRD-published-example, audit #65)", () => {
  const TY = 2026;

  /**
   * Source: IRD PAYE calculator + IR340 methodology
   * (https://www.ird.govt.nz/income-tax/paye-calculator)
   * IRD's published "PAYE deduction" combines income tax + ACC earner levy.
   * KiwiSaver and student loan are separate line items.
   */

  it("$1,000/week tax code M (2026): IRD PAYE = $154.00 IT + $16.70 ACC = $170.70", () => {
    // Annualised $52,000:
    //   Income tax: 15,600 × 0.105 + (52,000 − 15,600) × 0.175 = 1,638 + 6,370 = $8,008/yr → $154.00/wk
    //   ACC earner levy: 1000 × 0.0167 = $16.70/wk (under cap)
    //   Combined PAYE: $170.70/wk
    expect(calculatePaye(1000, "weekly", "M", TY)).toBeCloseTo(170.7, 1);
  });

  it("$2,000/fortnight tax code M (2026): IRD PAYE = $308.00 IT + $33.40 ACC = $341.40", () => {
    expect(calculatePaye(2000, "fortnightly", "M", TY)).toBeCloseTo(341.4, 1);
  });

  it("$200k/year tax code M (2026): IT $1,097.64 + capped ACC $49.07 = $1,146.71/wk", () => {
    // Annualised = $200,000
    //   Income tax: 57,077.50/52 = $1,097.64/wk
    //   ACC earner levy: capped at $152,790; per-week = 152,790/52 × 1.67/100 = $49.07
    //   Combined: $1,146.71
    const result = calculatePaye(200000 / 52, "weekly", "M", TY);
    expect(result).toBeCloseTo(1146.71, 1);
  });

  it("secondary code SB at $1,000/wk: 10.5% income tax + 1.67% ACC = $121.70", () => {
    // 1000 × 0.105 + 1000 × 0.0167 = 105 + 16.70 = $121.70
    expect(calculatePaye(1000, "weekly", "SB", TY)).toBeCloseTo(121.7, 1);
  });
});
