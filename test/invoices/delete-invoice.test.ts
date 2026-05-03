import { describe, it, expect } from "vitest";
import type { DeleteInvoiceResult } from "@/lib/invoices";

/**
 * The deleteInvoice happy path requires a live DB and is covered by
 * integration tests once the DB test harness lands. These tests pin the
 * result-shape contract so callers (API route, UI dialog, future chat
 * tool) can rely on the discriminated union.
 */
describe("DeleteInvoiceResult shape", () => {
  it("ok=true is the success shape", () => {
    const r: DeleteInvoiceResult = { ok: true };
    expect(r.ok).toBe(true);
  });

  it("not_found is a failure with no status", () => {
    const r: DeleteInvoiceResult = { ok: false, reason: "not_found" };
    expect(r.ok).toBe(false);
    if (r.ok === false && r.reason === "not_found") {
      expect("status" in r).toBe(false);
    }
  });

  it("not_deletable carries the offending status", () => {
    const r: DeleteInvoiceResult = {
      ok: false,
      reason: "not_deletable",
      status: "paid",
    };
    expect(r.ok).toBe(false);
    if (r.ok === false && r.reason === "not_deletable") {
      expect(r.status).toBe("paid");
    }
  });

  it("not_deletable also covers void", () => {
    const r: DeleteInvoiceResult = {
      ok: false,
      reason: "not_deletable",
      status: "void",
    };
    if (r.ok === false && r.reason === "not_deletable") {
      expect(r.status).toBe("void");
    }
  });

  it("has_payments carries amount_paid and payment_count", () => {
    const r: DeleteInvoiceResult = {
      ok: false,
      reason: "has_payments",
      amount_paid: 250.5,
      payment_count: 2,
    };
    expect(r.ok).toBe(false);
    if (r.ok === false && r.reason === "has_payments") {
      expect(r.amount_paid).toBe(250.5);
      expect(r.payment_count).toBe(2);
    }
  });
});
