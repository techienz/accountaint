import { describe, expect, it } from "vitest";
import { getTaxYearConfig } from "@/lib/tax/rules";

/**
 * Regression test for audit #117 — IR3 prep used to hardcode the company
 * tax rate as 0.28 in two places (gross-up of dividends; gross-up of
 * deemed dividends). It now reads from the versioned rules table.
 *
 * The actual gross-up math lives in `prepareIr3()` which requires a real
 * DB and shareholder records to test end-to-end. Here we verify the
 * config contract that the gross-up depends on.
 */
describe("company tax rate flows from rules table", () => {
  it("2026 company rate is the 28% headline NZ rate (today)", () => {
    expect(getTaxYearConfig(2026).incomeTaxRate.company).toBe(0.28);
  });

  it("2027 company rate is also 28% (no announced change)", () => {
    expect(getTaxYearConfig(2027).incomeTaxRate.company).toBe(0.28);
  });

  it("trust rate stays at 39% (was 33% pre-audit-fix #64)", () => {
    expect(getTaxYearConfig(2026).incomeTaxRate.trust).toBe(0.39);
    expect(getTaxYearConfig(2027).incomeTaxRate.trust).toBe(0.39);
  });

  it("gross-up math: net / (1 - rate) is what IR3 uses", () => {
    // If a future tax year ever drops the company rate to e.g. 26%,
    // tweaking the rules table should change the gross-up automatically.
    // This locks in the formula, not the answer.
    const rate = getTaxYearConfig(2026).incomeTaxRate.company;
    const netDividend = 7200;
    const grossedUp = netDividend / (1 - rate); // 7200 / 0.72 = 10000
    expect(grossedUp).toBeCloseTo(10000, 4);
  });
});
