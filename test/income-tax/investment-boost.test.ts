import { describe, expect, it } from "vitest";
import { calculateInvestmentBoost } from "@/lib/calculators/investment-boost";

/**
 * Issue #85 — Investment Boost (Budget 2025).
 * 20% upfront deduction on the cost of NEW (or new-to-NZ) depreciable
 * business assets acquired/finished construction on or after 22 May 2025.
 * Residential buildings excluded. No minimum value.
 *
 * Source: https://www.ird.govt.nz/investment-boost
 */
describe("calculateInvestmentBoost", () => {
  it("returns empty totals for an empty asset list", () => {
    const r = calculateInvestmentBoost([]);
    expect(r.totalIb).toBe(0);
    expect(r.assets).toEqual([]);
    expect(r.rate).toBe(0.2);
    expect(r.effectiveFrom).toBe("2025-05-22");
  });

  it("excludes assets purchased before 22 May 2025", () => {
    const r = calculateInvestmentBoost([
      { description: "Old laptop", cost: 5000, date: "2025-05-21" },
    ]);
    expect(r.totalIb).toBe(0);
    expect(r.assets[0].eligible).toBe(false);
    expect(r.assets[0].ibAmount).toBe(0);
    expect(r.assets[0].reason).toMatch(/before.*22 May 2025/i);
  });

  it("includes assets purchased on the boundary date 22 May 2025", () => {
    const r = calculateInvestmentBoost([
      { description: "Drill press", cost: 10_000, date: "2025-05-22" },
    ]);
    expect(r.assets[0].eligible).toBe(true);
    expect(r.assets[0].ibAmount).toBe(2000);
    expect(r.totalIb).toBe(2000);
  });

  it("calculates 20% on a single eligible asset purchased after the effective date", () => {
    const r = calculateInvestmentBoost([
      { description: "CNC machine", cost: 50_000, date: "2025-08-01" },
    ]);
    expect(r.assets[0].ibAmount).toBe(10_000);
    expect(r.totalIb).toBe(10_000);
  });

  it("excludes residential buildings even when otherwise eligible", () => {
    const r = calculateInvestmentBoost([
      {
        description: "Residential rental",
        cost: 600_000,
        date: "2026-01-15",
        isResidentialBuilding: true,
      },
    ]);
    expect(r.assets[0].eligible).toBe(false);
    expect(r.assets[0].ibAmount).toBe(0);
    expect(r.assets[0].reason).toMatch(/residential/i);
    expect(r.totalIb).toBe(0);
  });

  it("excludes assets explicitly flagged as not new (and not new-to-NZ)", () => {
    const r = calculateInvestmentBoost([
      { description: "Used van", cost: 25_000, date: "2025-09-10", isNew: false },
    ]);
    expect(r.assets[0].eligible).toBe(false);
    expect(r.assets[0].reason).toMatch(/new/i);
  });

  it("includes second-hand assets that are new to NZ (imported)", () => {
    const r = calculateInvestmentBoost([
      {
        description: "Imported tractor",
        cost: 80_000,
        date: "2025-09-10",
        isNew: false,
        isNewToNz: true,
      },
    ]);
    expect(r.assets[0].eligible).toBe(true);
    expect(r.assets[0].ibAmount).toBe(16_000);
  });

  it("flags assumesNew=true when isNew is unspecified, but still includes the asset", () => {
    const r = calculateInvestmentBoost([
      { description: "Forklift", cost: 30_000, date: "2025-07-01" },
    ]);
    expect(r.assets[0].eligible).toBe(true);
    expect(r.assets[0].ibAmount).toBe(6000);
    expect(r.assets[0].assumesNew).toBe(true);
  });

  it("does NOT flag assumesNew when isNew is explicitly true", () => {
    const r = calculateInvestmentBoost([
      { description: "New excavator", cost: 100_000, date: "2025-07-01", isNew: true },
    ]);
    expect(r.assets[0].assumesNew).toBe(false);
  });

  it("treats zero or negative cost as ineligible (no claim)", () => {
    const r = calculateInvestmentBoost([
      { description: "Free swag", cost: 0, date: "2026-02-01" },
      { description: "Bad data", cost: -100, date: "2026-02-01" },
    ]);
    expect(r.assets[0].eligible).toBe(false);
    expect(r.assets[1].eligible).toBe(false);
    expect(r.totalIb).toBe(0);
  });

  it("sums total IB across a mixed list (some eligible, some not)", () => {
    const r = calculateInvestmentBoost([
      { description: "Pre-budget asset", cost: 10_000, date: "2025-04-01" }, // out
      { description: "Post-budget asset", cost: 10_000, date: "2025-06-01" }, // in: 2000
      { description: "Used (not new-to-NZ)", cost: 10_000, date: "2025-06-01", isNew: false }, // out
      { description: "Residential", cost: 100_000, date: "2026-01-01", isResidentialBuilding: true }, // out
      { description: "New machinery", cost: 5000, date: "2026-01-01", isNew: true }, // in: 1000
    ]);
    expect(r.totalIb).toBe(3000);
    expect(r.assets.filter((a) => a.eligible).length).toBe(2);
  });

  it("rounds IB amount to 2 decimal places", () => {
    const r = calculateInvestmentBoost([
      { description: "Odd cost", cost: 1234.567, date: "2025-09-01" },
    ]);
    // 20% of 1234.567 = 246.9134 → 246.91
    expect(r.assets[0].ibAmount).toBe(246.91);
    expect(r.totalIb).toBe(246.91);
  });

  /**
   * Issue #150 — rate must come from TaxYearConfig, not the inline constant.
   * Calculator accepts an optional `taxYearLookup` so callers (gather.ts,
   * recomputeIb, prepareIR10) can pass `getTaxYearConfig`-derived config
   * instead of trusting hardcoded values. The default behaviour (no lookup)
   * preserves the Phase 1 rate of 0.20 from 2025-05-22 so existing call
   * sites keep working until they migrate.
   */
  describe("rate sourced from TaxYearConfig (#150)", () => {
    it("uses the rate returned by taxYearLookup for the asset's purchase-year tax year", () => {
      // Hypothetical 2027 budget halves the IB rate to 10%.
      const lookup = (year: number) =>
        year >= 2027
          ? { rate: 0.1, effectiveFrom: "2025-05-22" }
          : { rate: 0.2, effectiveFrom: "2025-05-22" };
      const r = calculateInvestmentBoost(
        [
          { description: "TY2026 asset", cost: 10_000, date: "2026-01-15", isNew: true }, // TY2026 → 20%
          { description: "TY2027 asset", cost: 10_000, date: "2026-08-15", isNew: true }, // TY2027 → 10%
        ],
        { taxYearLookup: lookup }
      );
      expect(r.assets[0].ibAmount).toBe(2000);
      expect(r.assets[1].ibAmount).toBe(1000);
      expect(r.totalIb).toBe(3000);
    });

    it("flags assets as ineligible with a clear reason when taxYearLookup returns null for that year", () => {
      const lookup = (year: number) =>
        year === 2026 ? { rate: 0.2, effectiveFrom: "2025-05-22" } : null;
      const r = calculateInvestmentBoost(
        [
          { description: "TY2026 ok", cost: 10_000, date: "2025-08-01", isNew: true }, // 2026 → eligible
          { description: "TY2028 sunset", cost: 10_000, date: "2027-08-01", isNew: true }, // 2028 → null
        ],
        { taxYearLookup: lookup }
      );
      expect(r.assets[0].eligible).toBe(true);
      expect(r.assets[0].ibAmount).toBe(2000);
      expect(r.assets[1].eligible).toBe(false);
      expect(r.assets[1].ibAmount).toBe(0);
      expect(r.assets[1].reason).toMatch(/not configured.*2028/i);
      expect(r.totalIb).toBe(2000);
    });

    it("uses the lookup's effectiveFrom when checking the boundary date", () => {
      // Hypothetical: a future budget shifts IB effective date to 1 Jul 2027.
      const lookup = () => ({ rate: 0.15, effectiveFrom: "2027-07-01" });
      const r = calculateInvestmentBoost(
        [
          { description: "Before new effective", cost: 10_000, date: "2027-06-30", isNew: true },
          { description: "On new effective", cost: 10_000, date: "2027-07-01", isNew: true },
        ],
        { taxYearLookup: lookup }
      );
      expect(r.assets[0].eligible).toBe(false);
      expect(r.assets[0].reason).toMatch(/before.*1 Jul 2027/i);
      expect(r.assets[1].eligible).toBe(true);
      expect(r.assets[1].ibAmount).toBe(1500); // 10000 × 0.15
    });
  });
});
