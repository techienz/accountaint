import { describe, expect, it } from "vitest";
import { aggregateIbForIR10, type IbAssetRow } from "@/lib/tax/ir10-prep";

/**
 * Issue #148 — pure aggregation logic for the new IR10 line:
 *   "Total value of assets for which Investment Boost is being claimed"
 *
 * IRD requires the GROSS asset cost (not the deduction amount) on the
 * IR10. The deduction itself ($cost × 20%) is captured separately so we
 * can show both numbers on the prep page.
 */
describe("aggregateIbForIR10", () => {
  function row(overrides: Partial<IbAssetRow>): IbAssetRow {
    return {
      id: "id",
      name: "Asset",
      cost: 5000,
      purchase_date: "2025-08-15",
      ib_excluded: false,
      ib_claimed_amount: 1000,
      ib_claimed_tax_year: "2026",
      ...overrides,
    };
  }

  it("returns zero totals when there are no rows", () => {
    const r = aggregateIbForIR10([], "2026");
    expect(r.ibTotalAssetCost).toBe(0);
    expect(r.ibTotalDeduction).toBe(0);
    expect(r.ibAssetCount).toBe(0);
    expect(r.ibAssets).toEqual([]);
  });

  it("aggregates a single laptop (worked example): $5k cost, $1k deduction, TY 2026", () => {
    const r = aggregateIbForIR10([row({})], "2026");
    expect(r.ibTotalAssetCost).toBe(5000);
    expect(r.ibTotalDeduction).toBe(1000);
    expect(r.ibAssetCount).toBe(1);
    expect(r.ibAssets[0].name).toBe("Asset");
  });

  it("filters to the requested tax year only", () => {
    const r = aggregateIbForIR10(
      [
        row({ id: "a", ib_claimed_tax_year: "2026", cost: 5000, ib_claimed_amount: 1000 }),
        row({ id: "b", ib_claimed_tax_year: "2027", cost: 10_000, ib_claimed_amount: 2000 }),
      ],
      "2026"
    );
    expect(r.ibAssetCount).toBe(1);
    expect(r.ibTotalAssetCost).toBe(5000);
    expect(r.ibTotalDeduction).toBe(1000);
  });

  it("excludes rows where ib_claimed_amount is null (not yet classified)", () => {
    const r = aggregateIbForIR10(
      [
        row({ id: "a", ib_claimed_amount: 1000, ib_claimed_tax_year: "2026" }),
        row({ id: "b", ib_claimed_amount: null, ib_claimed_tax_year: null }),
      ],
      "2026"
    );
    expect(r.ibAssetCount).toBe(1);
    expect(r.ibTotalDeduction).toBe(1000);
  });

  it("excludes rows where ib_excluded=true even if a stale ib_claimed_amount is present", () => {
    const r = aggregateIbForIR10(
      [
        row({ ib_excluded: true, ib_claimed_amount: 999, ib_claimed_tax_year: "2026" }),
      ],
      "2026"
    );
    expect(r.ibAssetCount).toBe(0);
    expect(r.ibTotalDeduction).toBe(0);
  });

  it("sums multiple eligible assets in the same tax year", () => {
    const r = aggregateIbForIR10(
      [
        row({ id: "a", cost: 5000, ib_claimed_amount: 1000 }),
        row({ id: "b", cost: 30_000, ib_claimed_amount: 6000 }),
        row({ id: "c", cost: 80_000, ib_claimed_amount: 16_000 }),
      ],
      "2026"
    );
    expect(r.ibAssetCount).toBe(3);
    expect(r.ibTotalAssetCost).toBe(115_000);
    expect(r.ibTotalDeduction).toBe(23_000);
  });

  it("rounds totals to 2 decimal places (defensive against float drift)", () => {
    const r = aggregateIbForIR10(
      [
        row({ id: "a", cost: 1234.567, ib_claimed_amount: 246.91 }),
        row({ id: "b", cost: 2345.678, ib_claimed_amount: 469.14 }),
      ],
      "2026"
    );
    expect(r.ibTotalAssetCost).toBe(3580.25);
    expect(r.ibTotalDeduction).toBe(716.05);
  });
});
