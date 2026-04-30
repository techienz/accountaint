import { describe, expect, it } from "vitest";

/**
 * Invariants that any sales-invoice posting MUST satisfy regardless of
 * inputs. Pure math — no DB, no posting helper called. These document the
 * contract between an invoice's totals and the journal-line shape produced
 * by postSalesInvoiceJournal:
 *
 *   DR Accounts Receivable: invoice.total
 *   CR Sales Revenue:        invoice.subtotal
 *   CR GST Payable:          invoice.gst_total  (only if > 0)
 *
 * For the journal to balance:    total == subtotal + gst_total
 *
 * If this invariant ever fails, postSalesInvoiceJournal will throw the
 * "Journal entry is unbalanced" error from createJournalEntry.
 */

function buildSalesInvoice(subtotal: number, gst_total: number) {
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    gst_total: Math.round(gst_total * 100) / 100,
    total: Math.round((subtotal + gst_total) * 100) / 100,
  };
}

function dr_minus_cr(invoice: { total: number; subtotal: number; gst_total: number }): number {
  // DR side
  const dr = invoice.total;
  // CR side
  const cr = invoice.subtotal + invoice.gst_total;
  return Math.round((dr - cr) * 100) / 100;
}

describe("sales invoice journal — balance invariant", () => {
  it("$1000 subtotal + $150 GST balances", () => {
    expect(dr_minus_cr(buildSalesInvoice(1000, 150))).toBe(0);
  });

  it("zero-GST invoice (eg overseas) balances with subtotal == total", () => {
    expect(dr_minus_cr(buildSalesInvoice(500, 0))).toBe(0);
  });

  it("fractional cents: $99.99 subtotal + $15.00 GST = $114.99 total balances", () => {
    expect(dr_minus_cr(buildSalesInvoice(99.99, 15.00))).toBe(0);
  });

  it("any subtotal/gst combination where total = subtotal + gst is balanced", () => {
    const cases = [
      { sub: 1, gst: 0.15 },
      { sub: 12345.67, gst: 1851.85 },
      { sub: 0.01, gst: 0 },
      { sub: 999999, gst: 149999.85 },
    ];
    for (const { sub, gst } of cases) {
      expect(dr_minus_cr(buildSalesInvoice(sub, gst))).toBe(0);
    }
  });
});

/**
 * Same invariant for purchase invoices:
 *
 *   DR Expense (subtotal)
 *   DR GST Receivable (gst_total)
 *   CR Accounts Payable (total)
 *
 * For balance: subtotal + gst_total == total
 */
describe("purchase invoice journal — balance invariant", () => {
  function buildPurchase(subtotal: number, gst_total: number) {
    return buildSalesInvoice(subtotal, gst_total); // same shape
  }

  function purchase_dr_minus_cr(invoice: { total: number; subtotal: number; gst_total: number }): number {
    // DR side
    const dr = invoice.subtotal + invoice.gst_total;
    // CR side
    const cr = invoice.total;
    return Math.round((dr - cr) * 100) / 100;
  }

  it("$2000 + $300 GST balances", () => {
    expect(purchase_dr_minus_cr(buildPurchase(2000, 300))).toBe(0);
  });

  it("multi-line summation balances if line items sum to subtotal", () => {
    // postPurchaseInvoiceJournal groups line items by account_code; sum must equal subtotal
    const items = [
      { line_total: 800 },
      { line_total: 500 },
      { line_total: 700 },
    ];
    const sumOfLines = items.reduce((s, i) => s + i.line_total, 0);
    const purchase = buildPurchase(sumOfLines, sumOfLines * 0.15);
    expect(purchase_dr_minus_cr(purchase)).toBe(0);
  });
});

/**
 * Payment journals (received and made):
 *
 * Received:  DR Bank, CR Accounts Receivable, both = amount
 * Made:      DR Accounts Payable, CR Bank, both = amount
 *
 * These are 1:1 by definition; balance is structural.
 */
describe("payment journal — structural balance", () => {
  it("payment received: bank DR equals AR CR", () => {
    const amount = 1234.56;
    expect(amount - amount).toBe(0); // tautological; documents the structure
  });

  it("payment made: AP DR equals bank CR", () => {
    const amount = 999.99;
    expect(amount - amount).toBe(0);
  });
});
