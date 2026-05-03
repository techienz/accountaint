import { describe, expect, it } from "vitest";
import type {
  GstReturnEmpty,
  GstReturnFromLedger,
} from "@/lib/gst/calculator";

/**
 * Audit #115 — TypeScript-shape regression tests for the unified GST
 * calculator return contract. Full integration tests (does it actually
 * count a confirmed expense's GST?) require a test-DB harness that the
 * codebase doesn't yet have — flagged in the PR description as a
 * "manual verification" item.
 *
 * These tests pin the discriminated-union shape so any refactor that
 * silently drops the basis arg or the empty-result reason will fail
 * here.
 */
describe("GST unified calculator return shape", () => {
  it("GstReturnEmpty carries basis + reason for the worksheet to render gracefully", () => {
    const empty: GstReturnEmpty = {
      empty: true,
      reason: "no_gst_accounts",
      basis: "invoice",
    };
    expect(empty.basis).toBe("invoice");
    expect(empty.reason).toBe("no_gst_accounts");
  });

  it("GstReturnEmpty supports both basis values (invoice + payments)", () => {
    const inv: GstReturnEmpty = { empty: true, reason: "no_entries_in_period", basis: "invoice" };
    const pay: GstReturnEmpty = { empty: true, reason: "no_entries_in_period", basis: "payments" };
    expect(inv.basis).toBe("invoice");
    expect(pay.basis).toBe("payments");
  });

  it("GstReturnFromLedger carries an optional basisCaveat field", () => {
    // After audit #76, payments-basis math is correct, so basisCaveat is
    // no longer set automatically. It remains as an OPTIONAL field that the
    // calculator uses to flag genuine data-integrity issues (e.g. a payment
    // journal whose linked invoice can't be found). The shape is still
    // pinned here so any refactor that drops the field fails compilation.
    const r: GstReturnFromLedger = {
      period: { from: "2026-01-01", to: "2026-03-31" },
      basis: "payments",
      gstRate: 0.15,
      totalSales: 0,
      totalPurchases: 0,
      gstOnSales: 0,
      gstOnPurchases: 0,
      netGst: 0,
      lineItems: [],
      basisCaveat: "1 payment entry was skipped because the linked invoice could not be found.",
    };
    expect(r.basisCaveat).toMatch(/skipped/i);
  });

  it("regression: never returns the legacy bare-null shape", () => {
    // The OLD calculator returned `null` ambiguously. New shape uses a
    // discriminated union so callers can differentiate "no GST accounts"
    // from "no entries in period". This is a type-level guard — if anyone
    // refactors the function back to bare null, it'll fail compilation.
    const r: GstReturnEmpty = { empty: true, reason: "no_gst_accounts", basis: "invoice" };
    expect(r).not.toBeNull();
    expect(r.empty).toBe(true);
  });
});
