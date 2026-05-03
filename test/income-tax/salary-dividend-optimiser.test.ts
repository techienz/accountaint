import { describe, expect, it } from "vitest";
import {
  calculateOptimiserScenario,
  optimiseSalaryDividend,
} from "@/lib/tax/salary-dividend-optimiser";

/**
 * Worked-example tests for the salary/dividend optimiser. Numbers are
 * hand-calculated against the 2025 tax-year rates in
 * src/lib/tax/rules/2025.ts.
 *
 * Issue #88 — the optimiser previously modelled income tax + imputation
 * only. These tests pin down the four missing pieces:
 *   1. ACC earner levy on salary
 *   2. KiwiSaver employer contribution (deductible to company)
 *   3. ESCT on KS employer (rate from employee's annual earnings)
 *   4. Retained earnings option (no payout — defer personal tax)
 *
 * IRD sources cited inline next to each rate.
 */

describe("calculateOptimiserScenario — worked example, year 2025", () => {
  /**
   * Inputs:
   *   companyProfit = $150,000 (before salary)
   *   salary        = $80,000
   *   KS enrolled   = yes, 3% employee + 3% employer (statutory minimum)
   *   otherIncome   = $0
   *   taxYear       = 2025
   *
   * Hand calculation:
   *   KS employer       = 80,000 × 3%                       = 2,400.00
   *   ESCT band for $80,000 annual earnings (2025): ≤ 84,000 → 30%
   *   ESCT              = 2,400 × 30%                       = 720.00
   *   Company deduction = 80,000 + 2,400 + 720              = 83,120.00
   *   Taxable profit    = 150,000 − 83,120                  = 66,880.00
   *   Company tax       = 66,880 × 28%                      = 18,726.40
   *   Dividend          = 66,880 − 18,726.40                = 48,153.60
   *   Grossed-up div    = 48,153.60 / (1 − 0.28)            = 66,880.00
   *   Imputation credit = 66,880 − 48,153.60                = 18,726.40
   *
   *   Personal income (taxable) = 80,000 + 66,880           = 146,880.00
   *   Personal tax (2025 brackets):
   *     0      – 15,600  @ 10.5%   on 15,600  = 1,638.00
   *     15,600 – 53,500  @ 17.5%   on 37,900  = 6,632.50
   *     53,500 – 78,100  @ 30%     on 24,600  = 7,380.00
   *     78,100 – 146,880 @ 33%     on 68,780  = 22,697.40
   *   Gross personal tax                       = 38,347.90
   *   Less imputation credits                  = 18,726.40
   *   Personal tax payable                     = 19,621.50
   *
   *   ACC earner levy (cap $142,283 → not hit):
   *     80,000 / 100 × 1.60                    = 1,280.00
   *   KS employee (cash deduction, not tax):
   *     80,000 × 3%                            = 2,400.00
   *
   *   Total tax to government:
   *     company 18,726.40 + ESCT 720 + personal 19,621.50 + ACC 1,280
   *                                            = 40,347.90
   */
  it("$150k profit, $80k salary, KS 3%/3%, no other income", () => {
    const r = calculateOptimiserScenario({
      salary: 80_000,
      companyProfit: 150_000,
      otherPersonalIncome: 0,
      taxYear: 2025,
      kiwisaverEnrolled: true,
      kiwisaverEmployerRate: 0.03,
      kiwisaverEmployeeRate: 0.03,
    });

    expect(r.payoutMode).toBe("split");
    expect(r.salary).toBe(80_000);
    expect(r.kiwisaverEmployer).toBe(2_400);
    expect(r.kiwisaverEmployee).toBe(2_400);
    expect(r.esct).toBe(720);
    expect(r.companyTax).toBe(18_726.4);
    expect(r.dividend).toBe(48_153.6);
    expect(r.imputationCredits).toBe(18_726.4);
    expect(r.personalTax).toBe(19_621.5);
    expect(r.accEarnerLevy).toBe(1_280);
    expect(r.retainedEarnings).toBe(0);
    expect(r.totalTax).toBe(40_347.9);
  });

  it("same profit + salary but KS not enrolled → no KS / no ESCT", () => {
    // Inputs identical to above except kiwisaverEnrolled = false.
    // Hand calc:
    //   Company deduction = 80,000 (salary only)
    //   Taxable profit    = 150,000 − 80,000              = 70,000
    //   Company tax       = 70,000 × 28%                  = 19,600
    //   Dividend          = 70,000 − 19,600               = 50,400
    //   Grossed-up div    = 50,400 / 0.72                 = 70,000
    //   Imputation credit = 70,000 − 50,400               = 19,600
    //   Personal income   = 80,000 + 70,000               = 150,000
    //   Personal tax 2025 brackets:
    //     1,638 + 6,632.50 + 7,380 + (71,900 × 0.33)      = 39,377.50
    //   Less imputation                                    = 19,777.50
    //   ACC levy 80,000/100 × 1.60                         = 1,280
    //   Total tax = 19,600 + 19,777.50 + 1,280             = 40,657.50
    const r = calculateOptimiserScenario({
      salary: 80_000,
      companyProfit: 150_000,
      otherPersonalIncome: 0,
      taxYear: 2025,
      kiwisaverEnrolled: false,
    });

    expect(r.kiwisaverEmployer).toBe(0);
    expect(r.kiwisaverEmployee).toBe(0);
    expect(r.esct).toBe(0);
    expect(r.companyTax).toBe(19_600);
    expect(r.dividend).toBe(50_400);
    expect(r.imputationCredits).toBe(19_600);
    expect(r.personalTax).toBe(19_777.5);
    expect(r.accEarnerLevy).toBe(1_280);
    expect(r.totalTax).toBe(40_657.5);
  });

  it("ACC earner levy is capped at the 2025 liable-earnings cap", () => {
    // 2025 cap = $142,283. A $200k salary is over cap → levy uses cap.
    // Levy = 142,283 / 100 × 1.60 = 2,276.528 → 2,276.53 (round to cents)
    const r = calculateOptimiserScenario({
      salary: 200_000,
      companyProfit: 250_000,
      otherPersonalIncome: 0,
      taxYear: 2025,
      kiwisaverEnrolled: false,
    });
    expect(r.accEarnerLevy).toBe(2_276.53);
  });

  it("retained-earnings scenario: $150k profit kept in company", () => {
    // payoutMode = "retain" → salary 0, dividend 0, retainedEarnings = afterTaxProfit
    //   Company tax = 150,000 × 28% = 42,000
    //   After-tax profit (retained) = 108,000
    //   Personal tax = 0 (no salary, no dividend, no other income)
    //   ACC levy = 0; ESCT = 0; KS = 0
    //   Total CURRENT-YEAR tax = 42,000 (personal tax deferred to future payout)
    const r = calculateOptimiserScenario({
      salary: 0,
      companyProfit: 150_000,
      otherPersonalIncome: 0,
      taxYear: 2025,
      kiwisaverEnrolled: false,
      payoutMode: "retain",
    });

    expect(r.payoutMode).toBe("retain");
    expect(r.salary).toBe(0);
    expect(r.dividend).toBe(0);
    expect(r.companyTax).toBe(42_000);
    expect(r.retainedEarnings).toBe(108_000);
    expect(r.personalTax).toBe(0);
    expect(r.accEarnerLevy).toBe(0);
    expect(r.totalTax).toBe(42_000);
  });
});

describe("optimiseSalaryDividend — scenarios + retained-earnings option", () => {
  it("includes a retained-earnings scenario by default", () => {
    const result = optimiseSalaryDividend({
      companyProfit: 150_000,
      otherPersonalIncome: 0,
      taxYear: 2025,
    });
    const retain = result.scenarios.find((s) => s.payoutMode === "retain");
    expect(retain).toBeDefined();
    expect(retain?.retainedEarnings).toBe(108_000);
  });

  it("returns the lowest-totalTax scenario as optimal", () => {
    const result = optimiseSalaryDividend({
      companyProfit: 150_000,
      otherPersonalIncome: 0,
      taxYear: 2025,
    });
    for (const s of result.scenarios) {
      expect(result.optimal.totalTax).toBeLessThanOrEqual(s.totalTax + 0.01);
    }
  });
});
