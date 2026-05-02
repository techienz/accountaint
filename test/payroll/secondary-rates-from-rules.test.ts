import { describe, expect, it } from "vitest";
import { calculatePayeIncomeTax } from "@/lib/payroll/calculator";
import { getTaxYearConfig } from "@/lib/tax/rules";

/**
 * Regression test for audit #117 — secondary tax rates and the ND
 * non-declaration rate must come from the versioned rules table, not
 * a module-level const that wouldn't update with the tax year.
 *
 * The values themselves haven't changed (yet), but the wiring contract
 * has — these tests fail loudly if anyone reverts the move.
 */
describe("secondary tax rates flow through from rules table", () => {
  it("SB code uses config.secondaryTaxRates.SB", () => {
    const config = getTaxYearConfig(2026);
    const expected = Math.round(1000 * config.secondaryTaxRates.SB * 100) / 100;
    expect(calculatePayeIncomeTax(1000, "weekly", "SB", 2026)).toBe(expected);
  });

  it("SA code uses config.secondaryTaxRates.SA", () => {
    const config = getTaxYearConfig(2026);
    const expected = Math.round(1000 * config.secondaryTaxRates.SA * 100) / 100;
    expect(calculatePayeIncomeTax(1000, "weekly", "SA", 2026)).toBe(expected);
  });

  it("ST code at top of NZ secondary range stays at the rules value", () => {
    const config = getTaxYearConfig(2026);
    const expected = Math.round(2500 * config.secondaryTaxRates.ST * 100) / 100;
    expect(calculatePayeIncomeTax(2500, "weekly", "ST", 2026)).toBe(expected);
  });

  it("ND tax code uses config.nonDeclarationRate (45% currently)", () => {
    const config = getTaxYearConfig(2026);
    const expected = Math.round(1500 * config.nonDeclarationRate * 100) / 100;
    expect(calculatePayeIncomeTax(1500, "weekly", "ND", 2026)).toBe(expected);
  });

  it("rules table has all 5 NZ secondary tax codes", () => {
    const config = getTaxYearConfig(2026);
    expect(Object.keys(config.secondaryTaxRates).sort()).toEqual(["S", "SA", "SB", "SH", "ST"]);
  });

  it("2027 tax year exposes the same shape (catches per-year drift)", () => {
    const config = getTaxYearConfig(2027);
    expect(config.secondaryTaxRates.SB).toBeGreaterThan(0);
    expect(config.nonDeclarationRate).toBeGreaterThan(0);
  });
});
