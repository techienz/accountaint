import type { XeroInvoice } from "@/lib/xero/types";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export type GstPeriod = {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
};

export type GstLineItem = {
  description: string;
  contactName: string;
  invoiceNumber: string;
  type: "sales" | "purchases";
  amount: number;
  gst: number;
};

export type GstReturnResult = {
  period: GstPeriod;
  basis: "invoice" | "payments";
  gstRate: number;
  totalSales: number;
  totalPurchases: number;
  gstOnSales: number;
  gstOnPurchases: number;
  netGst: number;
  lineItems: GstLineItem[];
};

export function calculateGstReturn(
  invoices: XeroInvoice[],
  period: GstPeriod,
  basis: "invoice" | "payments",
  gstRate: number
): GstReturnResult {
  const periodFrom = new Date(period.from);
  const periodTo = new Date(period.to);

  // Filter invoices within the period
  // Invoice basis: filter by invoice Date
  // Payments basis: use invoice date as proxy (limitation — cached data lacks payment dates)
  const periodInvoices = invoices.filter((inv) => {
    if (inv.Status === "DRAFT" || inv.Status === "DELETED" || inv.Status === "VOIDED") return false;
    const invDate = new Date(inv.Date);
    return invDate >= periodFrom && invDate <= periodTo;
  });

  const lineItems: GstLineItem[] = [];
  let totalSales = 0;
  let totalPurchases = 0;
  let gstOnSales = 0;
  let gstOnPurchases = 0;

  for (const inv of periodInvoices) {
    const isSales = inv.Type === "ACCREC";
    const totalExGst = inv.Total / (1 + gstRate);
    const gstAmount = inv.Total - totalExGst;

    if (isSales) {
      totalSales += totalExGst;
      gstOnSales += gstAmount;
    } else {
      totalPurchases += totalExGst;
      gstOnPurchases += gstAmount;
    }

    lineItems.push({
      description: inv.LineItems?.[0]?.Description || `Invoice ${inv.InvoiceNumber}`,
      contactName: inv.Contact.Name,
      invoiceNumber: inv.InvoiceNumber,
      type: isSales ? "sales" : "purchases",
      amount: round2(totalExGst),
      gst: round2(gstAmount),
    });
  }

  return {
    period,
    basis,
    gstRate,
    totalSales: round2(totalSales),
    totalPurchases: round2(totalPurchases),
    gstOnSales: round2(gstOnSales),
    gstOnPurchases: round2(gstOnPurchases),
    netGst: round2(gstOnSales - gstOnPurchases),
    lineItems,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calculate GST return from journal entries.
 * This is more accurate than the invoice-only version because it includes
 * expenses posted directly (not via invoices) and any manual GST adjustments.
 *
 * GST on sales = credits to GST Payable account (2200)
 * GST on purchases = debits to GST Receivable account (1300)
 */
export function calculateGstReturnFromLedger(
  businessId: string,
  period: GstPeriod,
  gstRate: number
): GstReturnResult | null {
  const db = getDb();

  // Find GST accounts for this business
  const gstPayableAccount = db
    .select()
    .from(schema.accounts)
    .where(
      and(
        eq(schema.accounts.business_id, businessId),
        eq(schema.accounts.code, "2200")
      )
    )
    .get();

  const gstReceivableAccount = db
    .select()
    .from(schema.accounts)
    .where(
      and(
        eq(schema.accounts.business_id, businessId),
        eq(schema.accounts.code, "1300")
      )
    )
    .get();

  if (!gstPayableAccount && !gstReceivableAccount) return null;

  // Get all posted journal entries in the period
  const entries = db
    .select()
    .from(schema.journalEntries)
    .where(
      and(
        eq(schema.journalEntries.business_id, businessId),
        eq(schema.journalEntries.is_posted, true)
      )
    )
    .all()
    .filter((e) => e.date >= period.from && e.date <= period.to);

  if (entries.length === 0) return null;

  const entryIds = new Set(entries.map((e) => e.id));
  const entryMap = new Map(entries.map((e) => [e.id, e]));

  // Get all journal lines for these entries that hit GST accounts
  const allLines = db.select().from(schema.journalLines).all();

  const gstLines = allLines.filter(
    (l) =>
      entryIds.has(l.journal_entry_id) &&
      (l.account_id === gstPayableAccount?.id || l.account_id === gstReceivableAccount?.id)
  );

  let gstOnSales = 0;
  let gstOnPurchases = 0;
  const lineItems: GstLineItem[] = [];

  for (const line of gstLines) {
    const entry = entryMap.get(line.journal_entry_id);
    if (!entry) continue;

    if (line.account_id === gstPayableAccount?.id) {
      // GST Payable: credits = GST collected on sales
      const gstAmount = line.credit - line.debit;
      gstOnSales += gstAmount;
      lineItems.push({
        description: entry.description,
        contactName: "",
        invoiceNumber: entry.source_id ?? "",
        type: "sales",
        amount: round2(gstAmount / gstRate),
        gst: round2(gstAmount),
      });
    } else if (line.account_id === gstReceivableAccount?.id) {
      // GST Receivable: debits = GST paid on purchases
      const gstAmount = line.debit - line.credit;
      gstOnPurchases += gstAmount;
      lineItems.push({
        description: entry.description,
        contactName: "",
        invoiceNumber: entry.source_id ?? "",
        type: "purchases",
        amount: round2(gstAmount / gstRate),
        gst: round2(gstAmount),
      });
    }
  }

  // Calculate totals from GST amounts
  const totalSales = round2(gstOnSales / gstRate);
  const totalPurchases = round2(gstOnPurchases / gstRate);

  return {
    period,
    basis: "invoice", // Ledger-based is always accrual
    gstRate,
    totalSales,
    totalPurchases,
    gstOnSales: round2(gstOnSales),
    gstOnPurchases: round2(gstOnPurchases),
    netGst: round2(gstOnSales - gstOnPurchases),
    lineItems,
  };
}
