import { describe, expect, it } from "vitest";
import {
  computeGstReturnFromSnapshot,
  type GstLedgerSnapshot,
  type GstPeriod,
} from "@/lib/gst/calculator";

/**
 * Audit #76 — Payments-basis GST math.
 *
 * NZ-tax sources cited:
 *  - IR365 (GST Guide) — Accounting basis section: payments basis recognises
 *    GST when payment is received (sales) or made (purchases). Available to
 *    businesses with turnover under $2 million.
 *  - GST Act 1985 s 9(2)(b) — Time of supply on payments basis: cash event
 *    governs the timing of recognition, not invoice posting.
 *
 * These tests build hand-crafted ledger snapshots (no DB harness needed) and
 * verify both bases produce the right numbers for the same data.
 */

const RATE = 0.15;
const GST_PAYABLE_ID = "acct-2200";
const GST_RECEIVABLE_ID = "acct-1300";

const PERIOD_Q1: GstPeriod = { from: "2026-01-01", to: "2026-03-31" };
const PERIOD_Q2: GstPeriod = { from: "2026-04-01", to: "2026-06-30" };

function emptySnapshot(overrides: Partial<GstLedgerSnapshot> = {}): GstLedgerSnapshot {
  return {
    entries: [],
    lines: [],
    payments: [],
    invoices: [],
    expenses: [],
    gstPayableAccountId: GST_PAYABLE_ID,
    gstReceivableAccountId: GST_RECEIVABLE_ID,
    ...overrides,
  };
}

describe("payments basis — sales (ACCREC)", () => {
  it("invoice issued in Q1, paid in Q2 → invoice basis recognises in Q1; payments basis recognises in Q2", () => {
    // Invoice: $1,150 incl. GST ($1,000 ex + $150 GST), issued 2026-02-15.
    // Payment: $1,150 received 2026-04-10.
    const snap: GstLedgerSnapshot = emptySnapshot({
      entries: [
        // Invoice journal in Q1 — DR AR, CR Sales, CR GST Payable
        { id: "je-inv-1", date: "2026-02-15", description: "Sales invoice INV-001", source_type: "invoice", source_id: "inv-1" },
        // Payment journal in Q2 — DR Cash, CR AR (no GST line — that's the point)
        { id: "je-pay-1", date: "2026-04-10", description: "Payment received", source_type: "payment", source_id: "pay-1" },
      ],
      lines: [
        // Invoice journal lines (only GST line is relevant for invoice-basis math)
        { journal_entry_id: "je-inv-1", account_id: GST_PAYABLE_ID, debit: 0, credit: 150 },
        // Payment journal — no GST account postings
      ],
      payments: [{ id: "pay-1", invoice_id: "inv-1", date: "2026-04-10", amount: 1150 }],
      invoices: [{ id: "inv-1", invoice_number: "INV-001", type: "ACCREC", total: 1150, gst_total: 150, contact_name: "Acme Ltd" }],
    });

    // Q1 view, invoice basis: full GST recognised
    const q1Inv = computeGstReturnFromSnapshot(snap, PERIOD_Q1, "invoice", RATE);
    expect("empty" in q1Inv && q1Inv.empty).toBeFalsy();
    if ("empty" in q1Inv && q1Inv.empty) throw new Error("unexpected empty");
    expect(q1Inv.gstOnSales).toBe(150);

    // Q1 view, payments basis: nothing yet (cash hasn't moved)
    // But Q1 also contains the invoice journal — payments basis skips it,
    // and there are no other entries in Q1, so result is empty.
    const q1Pay = computeGstReturnFromSnapshot(
      { ...snap, entries: [snap.entries[0]] }, // only Q1 entry
      PERIOD_Q1,
      "payments",
      RATE
    );
    expect("empty" in q1Pay && q1Pay.empty).toBe(true);

    // Q2 view, payments basis: full GST recognised at payment date
    const q2Pay = computeGstReturnFromSnapshot(
      { ...snap, entries: [snap.entries[1]] }, // only Q2 entry
      PERIOD_Q2,
      "payments",
      RATE
    );
    expect("empty" in q2Pay && q2Pay.empty).toBeFalsy();
    if ("empty" in q2Pay && q2Pay.empty) throw new Error("unexpected empty");
    expect(q2Pay.gstOnSales).toBe(150);
    expect(q2Pay.gstOnPurchases).toBe(0);
    expect(q2Pay.lineItems).toHaveLength(1);
    expect(q2Pay.lineItems[0].invoiceNumber).toBe("INV-001");
  });

  it("partial payment recognises proportional GST on payments basis", () => {
    // $1,150 invoice, $575 paid (50%) in Q2 → $75 GST in Q2.
    const snap: GstLedgerSnapshot = emptySnapshot({
      entries: [
        { id: "je-pay-1", date: "2026-04-10", description: "Payment received", source_type: "payment", source_id: "pay-1" },
      ],
      payments: [{ id: "pay-1", invoice_id: "inv-1", date: "2026-04-10", amount: 575 }],
      invoices: [{ id: "inv-1", invoice_number: "INV-001", type: "ACCREC", total: 1150, gst_total: 150, contact_name: "Acme Ltd" }],
    });

    const r = computeGstReturnFromSnapshot(snap, PERIOD_Q2, "payments", RATE);
    if ("empty" in r && r.empty) throw new Error("unexpected empty");
    expect(r.gstOnSales).toBe(75); // 575 × (150/1150) = 75
    expect(r.totalSales).toBe(500); // 575 - 75 = 500
  });
});

describe("payments basis — purchases (ACCPAY)", () => {
  it("purchase invoice paid → GST claimed at payment date, not invoice date", () => {
    const snap: GstLedgerSnapshot = emptySnapshot({
      entries: [
        { id: "je-inv-1", date: "2026-02-15", description: "Purchase invoice BILL-001", source_type: "invoice", source_id: "inv-1" },
        { id: "je-pay-1", date: "2026-04-10", description: "Payment made", source_type: "payment", source_id: "pay-1" },
      ],
      lines: [
        { journal_entry_id: "je-inv-1", account_id: GST_RECEIVABLE_ID, debit: 150, credit: 0 },
      ],
      payments: [{ id: "pay-1", invoice_id: "inv-1", date: "2026-04-10", amount: 1150 }],
      invoices: [{ id: "inv-1", invoice_number: "BILL-001", type: "ACCPAY", total: 1150, gst_total: 150, contact_name: "Vendor Co" }],
    });

    // Invoice basis Q1: GST claimed at invoice posting
    const q1Inv = computeGstReturnFromSnapshot(snap, PERIOD_Q1, "invoice", RATE);
    if ("empty" in q1Inv && q1Inv.empty) throw new Error("unexpected empty");
    expect(q1Inv.gstOnPurchases).toBe(150);

    // Payments basis Q2: GST claimed at payment date
    const q2Pay = computeGstReturnFromSnapshot(
      { ...snap, entries: [snap.entries[1]] }, // only Q2 payment entry
      PERIOD_Q2,
      "payments",
      RATE
    );
    if ("empty" in q2Pay && q2Pay.empty) throw new Error("unexpected empty");
    expect(q2Pay.gstOnPurchases).toBe(150);
    expect(q2Pay.gstOnSales).toBe(0);
  });
});

describe("direct expenses behave the same on both bases", () => {
  it("confirmed expense (cash-out at posting) is recognised in the same period regardless of basis", () => {
    const snap: GstLedgerSnapshot = emptySnapshot({
      entries: [
        { id: "je-exp-1", date: "2026-02-20", description: "Expense: Mitre 10", source_type: "expense", source_id: "exp-1" },
      ],
      lines: [
        { journal_entry_id: "je-exp-1", account_id: GST_RECEIVABLE_ID, debit: 30, credit: 0 },
      ],
      expenses: [{ id: "exp-1", vendor: "Mitre 10" }],
    });

    const inv = computeGstReturnFromSnapshot(snap, PERIOD_Q1, "invoice", RATE);
    const pay = computeGstReturnFromSnapshot(snap, PERIOD_Q1, "payments", RATE);
    if ("empty" in inv && inv.empty) throw new Error("invoice empty");
    if ("empty" in pay && pay.empty) throw new Error("payments empty");
    expect(inv.gstOnPurchases).toBe(30);
    expect(pay.gstOnPurchases).toBe(30);
    expect(inv.gstOnSales).toBe(0);
    expect(pay.gstOnSales).toBe(0);
  });
});

describe("manual GST adjustments are recognised on both bases", () => {
  it("manual journal posting to GST Payable shows up in both invoice and payments basis", () => {
    const snap: GstLedgerSnapshot = emptySnapshot({
      entries: [
        { id: "je-adj-1", date: "2026-03-25", description: "GST adjustment — bad debt write-off", source_type: "manual", source_id: null },
      ],
      lines: [
        // CR GST Payable -45 (debit it back: bad debt reduces sales GST owed)
        // Modelled as DR GST Payable 45 → reduces gstOnSales by 45
        { journal_entry_id: "je-adj-1", account_id: GST_PAYABLE_ID, debit: 45, credit: 0 },
      ],
    });

    const inv = computeGstReturnFromSnapshot(snap, PERIOD_Q1, "invoice", RATE);
    const pay = computeGstReturnFromSnapshot(snap, PERIOD_Q1, "payments", RATE);
    if ("empty" in inv && inv.empty) throw new Error("invoice empty");
    if ("empty" in pay && pay.empty) throw new Error("payments empty");
    expect(inv.gstOnSales).toBe(-45);
    expect(pay.gstOnSales).toBe(-45);
  });
});

describe("edge cases", () => {
  it("payment of a zero-rated invoice contributes no GST on payments basis", () => {
    const snap: GstLedgerSnapshot = emptySnapshot({
      entries: [
        { id: "je-pay-1", date: "2026-04-10", description: "Payment received", source_type: "payment", source_id: "pay-1" },
      ],
      payments: [{ id: "pay-1", invoice_id: "inv-1", date: "2026-04-10", amount: 1000 }],
      invoices: [{ id: "inv-1", invoice_number: "INV-EXPORT-1", type: "ACCREC", total: 1000, gst_total: 0, contact_name: "Export Buyer" }],
    });

    const r = computeGstReturnFromSnapshot(snap, PERIOD_Q2, "payments", RATE);
    // No GST contribution → no line items → empty result.
    expect("empty" in r && r.empty).toBe(true);
  });

  it("payment journal whose invoice link is missing surfaces a basisCaveat", () => {
    const snap: GstLedgerSnapshot = emptySnapshot({
      entries: [
        // Real payment with valid invoice (so the result isn't empty)
        { id: "je-pay-1", date: "2026-04-10", description: "Payment received", source_type: "payment", source_id: "pay-1" },
        // Orphaned payment journal — source_id points to nothing in payments table
        { id: "je-pay-2", date: "2026-05-01", description: "Payment received", source_type: "payment", source_id: "pay-missing" },
      ],
      payments: [{ id: "pay-1", invoice_id: "inv-1", date: "2026-04-10", amount: 575 }],
      invoices: [{ id: "inv-1", invoice_number: "INV-001", type: "ACCREC", total: 1150, gst_total: 150, contact_name: "Acme" }],
    });

    const r = computeGstReturnFromSnapshot(snap, PERIOD_Q2, "payments", RATE);
    if ("empty" in r && r.empty) throw new Error("unexpected empty");
    expect(r.gstOnSales).toBe(75); // only the matched payment counts
    expect(r.basisCaveat).toMatch(/skipped/i);
  });

  it("returns no_entries_in_period when payments-basis filtering removes every contributing entry", () => {
    // Invoice journal exists in Q1 — but payments basis ignores it.
    const snap: GstLedgerSnapshot = emptySnapshot({
      entries: [
        { id: "je-inv-1", date: "2026-02-15", description: "Sales invoice INV-001", source_type: "invoice", source_id: "inv-1" },
      ],
      lines: [
        { journal_entry_id: "je-inv-1", account_id: GST_PAYABLE_ID, debit: 0, credit: 150 },
      ],
      invoices: [{ id: "inv-1", invoice_number: "INV-001", type: "ACCREC", total: 1150, gst_total: 150, contact_name: "Acme" }],
    });

    const r = computeGstReturnFromSnapshot(snap, PERIOD_Q1, "payments", RATE);
    expect("empty" in r && r.empty).toBe(true);
  });

  it("returns no_gst_accounts when neither GST account is configured", () => {
    const snap = emptySnapshot({
      gstPayableAccountId: null,
      gstReceivableAccountId: null,
      entries: [
        { id: "je-1", date: "2026-02-01", description: "any", source_type: "manual", source_id: null },
      ],
    });
    const r = computeGstReturnFromSnapshot(snap, PERIOD_Q1, "invoice", RATE);
    expect("empty" in r && r.empty).toBe(true);
    if ("empty" in r && r.empty) {
      expect(r.reason).toBe("no_gst_accounts");
    }
  });
});

describe("hybrid basis — sales = invoice basis, purchases = payments basis", () => {
  it("ACCREC invoice in Q1 (no payment yet) → hybrid recognises sales GST in Q1", () => {
    const snap: GstLedgerSnapshot = emptySnapshot({
      entries: [
        { id: "je-inv-1", date: "2026-02-15", description: "Sales invoice INV-001", source_type: "invoice", source_id: "inv-1" },
      ],
      lines: [
        { journal_entry_id: "je-inv-1", account_id: GST_PAYABLE_ID, debit: 0, credit: 150 },
      ],
      invoices: [{ id: "inv-1", invoice_number: "INV-001", type: "ACCREC", total: 1150, gst_total: 150, contact_name: "Acme" }],
    });

    const r = computeGstReturnFromSnapshot(snap, PERIOD_Q1, "hybrid", RATE);
    if ("empty" in r && r.empty) throw new Error("unexpected empty");
    expect(r.gstOnSales).toBe(150);
    expect(r.gstOnPurchases).toBe(0);
    expect(r.totalSales).toBe(1000);
  });

  it("ACCPAY invoice in Q1 (no payment yet) → hybrid recognises NO purchase GST", () => {
    const snap: GstLedgerSnapshot = emptySnapshot({
      entries: [
        { id: "je-inv-1", date: "2026-02-15", description: "Purchase invoice BILL-001", source_type: "invoice", source_id: "inv-1" },
      ],
      lines: [
        { journal_entry_id: "je-inv-1", account_id: GST_RECEIVABLE_ID, debit: 60, credit: 0 },
      ],
      invoices: [{ id: "inv-1", invoice_number: "BILL-001", type: "ACCPAY", total: 460, gst_total: 60, contact_name: "Vendor" }],
    });

    const r = computeGstReturnFromSnapshot(snap, PERIOD_Q1, "hybrid", RATE);
    // No purchase GST yet (deferred to payment), no sales GST → empty result.
    expect("empty" in r && r.empty).toBe(true);
  });

  it("ACCPAY invoice posted Q1 + paid Q2 → hybrid recognises purchase GST in Q2", () => {
    const snap: GstLedgerSnapshot = emptySnapshot({
      entries: [
        { id: "je-pay-1", date: "2026-04-10", description: "Payment made", source_type: "payment", source_id: "pay-1" },
      ],
      payments: [{ id: "pay-1", invoice_id: "inv-1", date: "2026-04-10", amount: 460 }],
      invoices: [{ id: "inv-1", invoice_number: "BILL-001", type: "ACCPAY", total: 460, gst_total: 60, contact_name: "Vendor" }],
    });

    const r = computeGstReturnFromSnapshot(snap, PERIOD_Q2, "hybrid", RATE);
    if ("empty" in r && r.empty) throw new Error("unexpected empty");
    expect(r.gstOnPurchases).toBe(60);
    expect(r.gstOnSales).toBe(0);
  });

  it("ACCREC payment in Q2 (invoice was Q1) → hybrid does NOT double-count sales", () => {
    // Sales already recognised at invoice posting in Q1 under hybrid.
    // The payment journal in Q2 must not also contribute.
    const snap: GstLedgerSnapshot = emptySnapshot({
      entries: [
        { id: "je-pay-1", date: "2026-04-10", description: "Payment received", source_type: "payment", source_id: "pay-1" },
      ],
      payments: [{ id: "pay-1", invoice_id: "inv-1", date: "2026-04-10", amount: 1150 }],
      invoices: [{ id: "inv-1", invoice_number: "INV-001", type: "ACCREC", total: 1150, gst_total: 150, contact_name: "Acme" }],
    });

    const r = computeGstReturnFromSnapshot(snap, PERIOD_Q2, "hybrid", RATE);
    expect("empty" in r && r.empty).toBe(true);
  });

  it("hybrid mixes both: sales invoice in Q1 + purchase payment in Q1 → both recognised", () => {
    const snap: GstLedgerSnapshot = emptySnapshot({
      entries: [
        { id: "je-inv-s", date: "2026-02-10", description: "Sales invoice INV-S", source_type: "invoice", source_id: "inv-s" },
        { id: "je-pay-p", date: "2026-02-15", description: "Payment made", source_type: "payment", source_id: "pay-p" },
      ],
      lines: [
        { journal_entry_id: "je-inv-s", account_id: GST_PAYABLE_ID, debit: 0, credit: 150 },
      ],
      payments: [{ id: "pay-p", invoice_id: "inv-p", date: "2026-02-15", amount: 460 }],
      invoices: [
        { id: "inv-s", invoice_number: "INV-S", type: "ACCREC", total: 1150, gst_total: 150, contact_name: "Cust" },
        { id: "inv-p", invoice_number: "INV-P", type: "ACCPAY", total: 460, gst_total: 60, contact_name: "Sup" },
      ],
    });

    const r = computeGstReturnFromSnapshot(snap, PERIOD_Q1, "hybrid", RATE);
    if ("empty" in r && r.empty) throw new Error("unexpected empty");
    expect(r.gstOnSales).toBe(150);
    expect(r.gstOnPurchases).toBe(60);
    expect(r.netGst).toBe(90);
  });

  it("hybrid + direct expense → recognised in same period (cash-realised)", () => {
    const snap: GstLedgerSnapshot = emptySnapshot({
      entries: [
        { id: "je-exp-1", date: "2026-02-20", description: "Expense: Mitre 10", source_type: "expense", source_id: "exp-1" },
      ],
      lines: [
        { journal_entry_id: "je-exp-1", account_id: GST_RECEIVABLE_ID, debit: 30, credit: 0 },
      ],
      expenses: [{ id: "exp-1", vendor: "Mitre 10" }],
    });

    const r = computeGstReturnFromSnapshot(snap, PERIOD_Q1, "hybrid", RATE);
    if ("empty" in r && r.empty) throw new Error("unexpected empty");
    expect(r.gstOnPurchases).toBe(30);
  });
});

describe("totalSales / totalPurchases — direct sum, not back-derived from gstOnSales/rate", () => {
  it("payments basis with non-15% effective ratio: totalSales matches summed exGstShare exactly", () => {
    // Invoice total $1,100, GST $100 → effective rate 100/1100 = 9.09%, NOT 15%.
    // Back-deriving totalSales from gstOnSales / 0.15 would give 666.67 (wrong).
    // The correct totalSales = $1,100 - $100 = $1,000.
    const snap: GstLedgerSnapshot = emptySnapshot({
      entries: [
        { id: "je-pay-1", date: "2026-04-10", description: "Payment received", source_type: "payment", source_id: "pay-1" },
      ],
      payments: [{ id: "pay-1", invoice_id: "inv-1", date: "2026-04-10", amount: 1100 }],
      invoices: [{ id: "inv-1", invoice_number: "MIXED-1", type: "ACCREC", total: 1100, gst_total: 100, contact_name: "Cust" }],
    });

    const r = computeGstReturnFromSnapshot(snap, PERIOD_Q2, "payments", RATE);
    if ("empty" in r && r.empty) throw new Error("unexpected empty");
    expect(r.gstOnSales).toBe(100);
    expect(r.totalSales).toBe(1000); // direct sum, not 100/0.15 = 666.67
    expect(r.lineItems[0].amount).toBe(1000);
    expect(r.lineItems[0].gst).toBe(100);
  });

  it("invoice basis on an invoice journal: totalSales uses invoice.subtotal, not back-derivation", () => {
    // Same mixed-rate fixture but on invoice basis. The invoice journal's GST
    // line credits GST Payable $100. With the invoice-aware fix, totalSales
    // should use the invoice's subtotal (total - gst_total = 1000) rather
    // than back-deriving 100 / 0.15 = 666.67.
    const snap: GstLedgerSnapshot = emptySnapshot({
      entries: [
        { id: "je-inv-1", date: "2026-02-15", description: "Sales invoice MIXED-1", source_type: "invoice", source_id: "inv-1" },
      ],
      lines: [
        { journal_entry_id: "je-inv-1", account_id: GST_PAYABLE_ID, debit: 0, credit: 100 },
      ],
      invoices: [{ id: "inv-1", invoice_number: "MIXED-1", type: "ACCREC", total: 1100, gst_total: 100, contact_name: "Cust" }],
    });

    const r = computeGstReturnFromSnapshot(snap, PERIOD_Q1, "invoice", RATE);
    if ("empty" in r && r.empty) throw new Error("unexpected empty");
    expect(r.gstOnSales).toBe(100);
    expect(r.totalSales).toBe(1000);
  });
});

describe("invariants", () => {
  it("netGst on payments basis = gstOnSales − gstOnPurchases (no rounding drift)", () => {
    const snap: GstLedgerSnapshot = emptySnapshot({
      entries: [
        { id: "je-pay-s", date: "2026-04-10", description: "Sales payment", source_type: "payment", source_id: "pay-s" },
        { id: "je-pay-p", date: "2026-04-15", description: "Purchase payment", source_type: "payment", source_id: "pay-p" },
      ],
      payments: [
        { id: "pay-s", invoice_id: "inv-s", date: "2026-04-10", amount: 1150 },
        { id: "pay-p", invoice_id: "inv-p", date: "2026-04-15", amount: 460 },
      ],
      invoices: [
        { id: "inv-s", invoice_number: "S1", type: "ACCREC", total: 1150, gst_total: 150, contact_name: "Cust" },
        { id: "inv-p", invoice_number: "P1", type: "ACCPAY", total: 460, gst_total: 60, contact_name: "Sup" },
      ],
    });

    const r = computeGstReturnFromSnapshot(snap, PERIOD_Q2, "payments", RATE);
    if ("empty" in r && r.empty) throw new Error("unexpected empty");
    expect(r.gstOnSales).toBe(150);
    expect(r.gstOnPurchases).toBe(60);
    expect(r.netGst).toBe(90);
  });

  it("over multiple partial payments, total recognised GST = invoice.gst_total when fully paid", () => {
    const snap: GstLedgerSnapshot = emptySnapshot({
      entries: [
        { id: "je-1", date: "2026-04-10", description: "Partial 1", source_type: "payment", source_id: "p1" },
        { id: "je-2", date: "2026-04-20", description: "Partial 2", source_type: "payment", source_id: "p2" },
        { id: "je-3", date: "2026-05-05", description: "Final", source_type: "payment", source_id: "p3" },
      ],
      payments: [
        { id: "p1", invoice_id: "inv-1", date: "2026-04-10", amount: 460 },  // 40%
        { id: "p2", invoice_id: "inv-1", date: "2026-04-20", amount: 460 },  // 40%
        { id: "p3", invoice_id: "inv-1", date: "2026-05-05", amount: 230 },  // 20%
      ],
      invoices: [{ id: "inv-1", invoice_number: "I1", type: "ACCREC", total: 1150, gst_total: 150, contact_name: "C" }],
    });

    const r = computeGstReturnFromSnapshot(snap, PERIOD_Q2, "payments", RATE);
    if ("empty" in r && r.empty) throw new Error("unexpected empty");
    expect(r.gstOnSales).toBe(150);
  });
});
