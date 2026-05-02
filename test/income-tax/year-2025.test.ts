import { describe, expect, it } from "vitest";
import { getTaxYearConfig } from "@/lib/tax/rules";

/**
 * Audit #84 — adds the 2025 tax-year config (year ending 31 March 2025)
 * so users can file IR3 / IR4 / IR526 etc. for the year that just closed.
 */
describe("2025 tax-year config", () => {
  const c = getTaxYearConfig(2025);

  it("has trustee rate 39% (Trustee Tax Rate Increase Act applies from 1 Apr 2024)", () => {
    expect(c.incomeTaxRate.trust).toBe(0.39);
  });

  it("has company rate 28% (unchanged)", () => {
    expect(c.incomeTaxRate.company).toBe(0.28);
  });

  it("has GST 15% (unchanged)", () => {
    expect(c.gstRate).toBe(0.15);
  });

  it("has the 2025-specific ACC earner levy (rate 1.60, cap $142,283) — different from 2026", () => {
    expect(c.accEarnerLevyRate).toBe(1.60);
    expect(c.accEarnerLevyCap).toBe(142283);
    // Sanity: must NOT match 2026's values
    const c2026 = getTaxYearConfig(2026);
    expect(c.accEarnerLevyRate).not.toBe(c2026.accEarnerLevyRate);
    expect(c.accEarnerLevyCap).not.toBe(c2026.accEarnerLevyCap);
  });

  it("has 2025-specific minimum wage $23.15", () => {
    expect(c.minimumWage).toBe(23.15);
    expect(c.minimumWageStartingOut).toBe(18.52);
  });

  it("has the 2025 ESCT brackets (pre-1-April-2025 thresholds)", () => {
    const thresholds = c.esctBrackets.slice(0, 4).map((b) => b.threshold);
    expect(thresholds).toEqual([16800, 57600, 84000, 216000]);
  });

  it("has 2025-source kilometre rates (per-fuel-type Tier 1/2)", () => {
    expect(c.kilometreRates.rates.petrol.tier1).toBe(1.17);
    expect(c.kilometreRates.rates.diesel.tier1).toBe(1.26);
    expect(c.kilometreRates.tier1CapKm).toBe(14000);
    expect(c.kilometreRates.sourceOperationalStatement).toMatch(/OS 19\/04-KM-2025/);
  });

  it("has the 2025 home-office sqm rate ($55.60)", () => {
    expect(c.homeOfficeSqmRate).toBe(55.60);
  });

  it("does NOT carry the deprecated prescribedInterestRate field", () => {
    // Audit #77 — moved out of TaxYearConfig
    expect((c as unknown as { prescribedInterestRate?: number }).prescribedInterestRate).toBeUndefined();
  });
});
