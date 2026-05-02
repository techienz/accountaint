import { describe, expect, it } from "vitest";
import { calculateHomeOffice } from "@/lib/calculators/home-office";

/**
 * Audit #86 regression — sqm_rate method previously was a no-op (returned
 * exactly the same as proportional). The IRD-correct sqm_rate combines
 * a per-m² flat portion (utilities/telco/depreciation) with prorated
 * premises costs (rates/insurance/mortgage/rent).
 */
describe("calculateHomeOffice — sqm_rate vs proportional", () => {
  const standardCosts = {
    rates: 4000,
    insurance: 2000,
    mortgage_interest: 24000,
    rent: 0,
    power: 3000,
    internet: 1200,
  };
  const officeArea = 15;
  const totalArea = 150;

  it("proportional: prorates EVERY cost by area ratio", () => {
    const r = calculateHomeOffice("proportional", officeArea, totalArea, standardCosts);
    expect(r.method).toBe("proportional");
    expect(r.proportion).toBe(0.1);
    // 10% of (4000 + 2000 + 24000 + 0 + 3000 + 1200) = 10% of 34200 = 3420
    expect(r.totalClaim).toBe(3420);
  });

  it("sqm_rate: produces a DIFFERENT (and larger) result than proportional", () => {
    // Premises: 10% of (4000 + 2000 + 24000 + 0) = 3000
    // Flat: 15 m² × $55.60/m² = 834
    // Total: 3000 + 834 = 3834
    const r = calculateHomeOffice("sqm_rate", officeArea, totalArea, standardCosts, 2026);
    expect(r.method).toBe("sqm_rate");
    expect(r.totalClaim).toBeCloseTo(3834, 2);

    const propResult = calculateHomeOffice("proportional", officeArea, totalArea, standardCosts);
    expect(r.totalClaim, "sqm_rate must NOT match proportional — that was the bug").not.toBe(propResult.totalClaim);
  });

  it("sqm_rate: power and internet are NOT prorated (flat rate covers them)", () => {
    const r = calculateHomeOffice("sqm_rate", officeArea, totalArea, standardCosts, 2026);
    const lineItems = r.breakdown.map((b) => b.item);
    expect(lineItems).not.toContain("Power");
    expect(lineItems).not.toContain("Internet");
    // But rates/insurance/mortgage SHOULD be there
    expect(lineItems).toContain("Rates");
    expect(lineItems).toContain("Insurance");
    expect(lineItems).toContain("Mortgage Interest");
  });

  it("sqm_rate: shows the flat-rate portion as a line item with the per-m² calculation", () => {
    const r = calculateHomeOffice("sqm_rate", 20, 200, standardCosts, 2026);
    const flatLine = r.breakdown.find((b) => b.item.includes("Utilities"));
    expect(flatLine).toBeDefined();
    expect(flatLine!.claim).toBeCloseTo(20 * 55.60, 2);
  });

  it("sqm_rate: surfaces the IRD operational statement source", () => {
    const r = calculateHomeOffice("sqm_rate", officeArea, totalArea, standardCosts, 2026);
    expect(r.sqmRateDetail?.sourceOperationalStatement).toMatch(/OS 19\/03/);
    expect(r.sqmRateDetail?.sqmRate).toBe(55.60);
  });

  it("sqm_rate: looks up the per-m² rate from the requested tax year", () => {
    const r2026 = calculateHomeOffice("sqm_rate", 10, 100, standardCosts, 2026);
    const r2027 = calculateHomeOffice("sqm_rate", 10, 100, standardCosts, 2027);
    // Both currently $55.60 (2027 placeholder until OS 19/03 CPI 2027 is published)
    expect(r2026.sqmRateDetail?.sqmRate).toBeGreaterThan(0);
    expect(r2027.sqmRateDetail?.sqmRate).toBeGreaterThan(0);
  });

  it("regression: under sqm_rate, doubling office area DOUBLES the flat portion", () => {
    const small = calculateHomeOffice("sqm_rate", 10, 200, { ...standardCosts, rates: 0, insurance: 0, mortgage_interest: 0, rent: 0 }, 2026);
    const big = calculateHomeOffice("sqm_rate", 20, 200, { ...standardCosts, rates: 0, insurance: 0, mortgage_interest: 0, rent: 0 }, 2026);
    expect(big.totalClaim).toBeCloseTo(small.totalClaim * 2, 2);
  });

  it("regression: never returns the same answer for proportional and sqm_rate (the audit-flagged bug)", () => {
    const props = calculateHomeOffice("proportional", 15, 150, standardCosts);
    const sqm = calculateHomeOffice("sqm_rate", 15, 150, standardCosts, 2026);
    expect(sqm.totalClaim).not.toBe(props.totalClaim);
  });
});
