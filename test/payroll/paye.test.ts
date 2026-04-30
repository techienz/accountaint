import { describe, expect, it } from "vitest";
import { calculatePaye } from "@/lib/payroll/calculator";
import { getTaxYearConfig } from "@/lib/tax/rules";

/**
 * PAYE calculation tests.
 * Coverage: secondary tax codes, primary tax code band math, edge cases.
 *
 * Rate-derived: expected values computed from the rate tables in
 * src/lib/tax/rules/2026.ts. Use IR340 worked examples to promote these
 * to IRD-published-example status (replace expected with IRD's printed value).
 */

describe("calculatePaye — secondary tax codes (2026)", () => {
  const TY = 2026;

  it("SB code applies 10.5% flat", () => {
    expect(calculatePaye(1000, "weekly", "SB", TY)).toBe(105.0);
  });

  it("S code applies 17.5% flat", () => {
    expect(calculatePaye(1000, "weekly", "S", TY)).toBe(175.0);
  });

  it("SH code applies 30% flat", () => {
    expect(calculatePaye(1000, "weekly", "SH", TY)).toBe(300.0);
  });

  it("ST code applies 33% flat", () => {
    expect(calculatePaye(1000, "weekly", "ST", TY)).toBe(330.0);
  });

  it("SA code applies 39% flat", () => {
    expect(calculatePaye(1000, "weekly", "SA", TY)).toBe(390.0);
  });

  it("ND no-declaration code applies 45% flat", () => {
    expect(calculatePaye(1000, "weekly", "ND", TY)).toBe(450.0);
  });

  it("secondary codes ignore SL suffix in base", () => {
    // SL means student loan in addition; the secondary tax rate itself is unchanged
    expect(calculatePaye(1000, "weekly", "SB SL", TY)).toBe(105.0);
  });
});

describe("calculatePaye — primary tax code M (2026 brackets)", () => {
  const TY = 2026;
  const config = getTaxYearConfig(TY);

  it("zero income → zero PAYE", () => {
    expect(calculatePaye(0, "weekly", "M", TY)).toBe(0);
  });

  it("$100/week stays in lowest band (10.5%)", () => {
    // Annualise $100 × 52 = $5,200; entirely below $15,600 threshold
    // PAYE: 5,200 × 0.105 = $546/year → $10.50/week
    expect(calculatePaye(100, "weekly", "M", TY)).toBe(10.5);
  });

  it("annualised income at exactly the first bracket threshold ($15,600)", () => {
    // 15600/52 = $300 weekly; bracket 1 fully used = 15,600 × 0.105 = $1,638
    // Per week: 1,638 / 52 = $31.50
    const grossWeekly = 15600 / 52;
    expect(calculatePaye(grossWeekly, "weekly", "M", TY)).toBeCloseTo(31.5, 1);
  });

  it("annualised income spanning bracket 1 + bracket 2", () => {
    // $40,000/year = $769.23/week
    // Tax: 15,600 × 0.105 + (40,000 - 15,600) × 0.175
    //    = 1,638 + 24,400 × 0.175
    //    = 1,638 + 4,270 = $5,908/year
    // Per week: 5,908 / 52 = $113.62
    const expected = (15600 * 0.105 + (40000 - 15600) * 0.175) / 52;
    expect(calculatePaye(40000 / 52, "weekly", "M", TY)).toBeCloseTo(expected, 1);
  });

  it("annualised income spanning all five brackets", () => {
    // $200,000 hits the top (39%) band
    // Bracket math: 15,600×0.105 + (53,500-15,600)×0.175 + (78,100-53,500)×0.30 + (180,000-78,100)×0.33 + (200,000-180,000)×0.39
    const annual =
      15600 * 0.105 +
      (53500 - 15600) * 0.175 +
      (78100 - 53500) * 0.30 +
      (180000 - 78100) * 0.33 +
      (200000 - 180000) * 0.39;
    const expectedWeekly = annual / 52;
    expect(calculatePaye(200000 / 52, "weekly", "M", TY)).toBeCloseTo(expectedWeekly, 1);
  });

  it("fortnightly equivalent of $40,000/year matches weekly equivalent", () => {
    const weekly = calculatePaye(40000 / 52, "weekly", "M", TY);
    const fortnightly = calculatePaye(40000 / 26, "fortnightly", "M", TY);
    // Fortnightly should be ~2x weekly (rounding aside)
    expect(fortnightly).toBeCloseTo(weekly * 2, 1);
  });

  it("M and ME tax codes produce same PAYE for the same income", () => {
    // ME (with main earnings + ML benefit) uses same brackets in this implementation
    expect(calculatePaye(800, "weekly", "M", TY)).toBe(calculatePaye(800, "weekly", "ME", TY));
  });

  it("personal income tax brackets in config match expected values for tax year 2026", () => {
    // Locks the brackets so any rate change is a deliberate edit + test bump
    expect(config.personalIncomeTaxBrackets).toEqual([
      { threshold: 15600, rate: 0.105 },
      { threshold: 53500, rate: 0.175 },
      { threshold: 78100, rate: 0.30 },
      { threshold: 180000, rate: 0.33 },
      { threshold: Infinity, rate: 0.39 },
    ]);
  });
});

describe("calculatePaye — primary tax code M (2027 brackets)", () => {
  const TY = 2027;

  it("config exists for 2027", () => {
    expect(() => getTaxYearConfig(TY)).not.toThrow();
  });

  it("zero income → zero PAYE", () => {
    expect(calculatePaye(0, "weekly", "M", TY)).toBe(0);
  });

  it("low primary income computes correctly using 2027 first bracket", () => {
    const config = getTaxYearConfig(TY);
    const firstBracket = config.personalIncomeTaxBrackets[0];
    const annualised = firstBracket.threshold; // exactly at threshold
    const expected = (annualised * firstBracket.rate) / 52;
    expect(calculatePaye(annualised / 52, "weekly", "M", TY)).toBeCloseTo(expected, 1);
  });
});
