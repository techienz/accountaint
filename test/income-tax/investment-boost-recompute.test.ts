import { describe, expect, it } from "vitest";
import { recomputeAssetIb, type AssetIbInput } from "@/lib/assets/investment-boost";

/**
 * Issue #148 — server-side recompute helper that runs whenever an asset
 * row is created or updated. Translates schema-shape (boolean | null
 * tri-state) into the calculator's optional inputs, then returns the
 * persisted IB fields (`ib_claimed_amount`, `ib_claimed_tax_year`).
 */
describe("recomputeAssetIb", () => {
  function asset(overrides: Partial<AssetIbInput>): AssetIbInput {
    return {
      name: "Laptop",
      cost: 5000,
      purchase_date: "2025-08-15",
      is_new: null,
      is_new_to_nz: null,
      ib_excluded: false,
      ...overrides,
    };
  }

  it("computes $1,000 IB and tax year 2026 for the worked example (laptop, $5k, 2025-08-15, is_new=true)", () => {
    const r = recomputeAssetIb(asset({ is_new: true }));
    expect(r.ib_claimed_amount).toBe(1000);
    expect(r.ib_claimed_tax_year).toBe("2026");
    expect(r.eligible).toBe(true);
  });

  it("returns nulls when is_new is null (Don't know — no silent assumption)", () => {
    const r = recomputeAssetIb(asset({ is_new: null }));
    expect(r.ib_claimed_amount).toBeNull();
    expect(r.ib_claimed_tax_year).toBeNull();
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/new|don't know/i);
  });

  it("returns nulls when is_new=false and is_new_to_nz is null", () => {
    const r = recomputeAssetIb(asset({ is_new: false, is_new_to_nz: null }));
    expect(r.ib_claimed_amount).toBeNull();
    expect(r.ib_claimed_tax_year).toBeNull();
    expect(r.eligible).toBe(false);
  });

  it("computes IB for second-hand asset that is new to NZ", () => {
    const r = recomputeAssetIb(
      asset({ is_new: false, is_new_to_nz: true, cost: 30_000 })
    );
    expect(r.ib_claimed_amount).toBe(6000);
    expect(r.ib_claimed_tax_year).toBe("2026");
    expect(r.eligible).toBe(true);
  });

  it("returns nulls when ib_excluded=true (e.g. residential building)", () => {
    const r = recomputeAssetIb(
      asset({ is_new: true, ib_excluded: true, cost: 600_000 })
    );
    expect(r.ib_claimed_amount).toBeNull();
    expect(r.ib_claimed_tax_year).toBeNull();
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/excluded/i);
  });

  it("returns nulls for assets purchased before 22 May 2025", () => {
    const r = recomputeAssetIb(asset({ is_new: true, purchase_date: "2025-05-21" }));
    expect(r.ib_claimed_amount).toBeNull();
    expect(r.ib_claimed_tax_year).toBeNull();
  });

  it("derives correct tax year from purchase date (Jan 2026 → TY 2026)", () => {
    const r = recomputeAssetIb(
      asset({ is_new: true, purchase_date: "2026-01-15" })
    );
    expect(r.ib_claimed_tax_year).toBe("2026");
  });

  it("derives correct tax year from purchase date (Apr 2026 → TY 2027)", () => {
    const r = recomputeAssetIb(
      asset({ is_new: true, purchase_date: "2026-04-15" })
    );
    expect(r.ib_claimed_tax_year).toBe("2027");
  });
});
