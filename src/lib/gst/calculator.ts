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

export type GstReturnEmpty = {
  empty: true;
  reason: "no_gst_accounts" | "no_entries_in_period";
  basis: "invoice" | "payments";
};

export type GstReturnFromLedger = GstReturnResult & {
  empty?: false;
  /** Set when basis="payments" — true payments-basis math is tracked in
   *  audit #76. For now the calculator returns accrual numbers with
   *  the basis label honoured and a warning. */
  basisCaveat?: string;
};

/**
 * Calculate GST return from journal entries. Replaces the older
 * invoice-only `calculateGstReturn` for the /tax-prep/gst flow + the
 * `calculate_gst_return` chat tool. Audit #115.
 *
 * What this captures that invoice-based didn't:
 * - Confirmed expenses entered without an invoice
 * - Manual GST adjustment journals
 * - Any future bookkeeping that posts to the GST accounts directly
 *
 * What it doesn't capture (yet, audit #76):
 * - True payments-basis filing (where GST is recognised on cash receipt
 *   not on invoice posting). The `basis` arg is passed through and a
 *   `basisCaveat` is attached, but the math is accrual-only for now.
 *
 * Contact + invoice context is resolved from journal source_type/source_id
 * via small joins so the worksheet drilldown shows useful labels rather
 * than raw entry descriptions.
 *
 * GST on sales = credits to GST Payable (2200)
 * GST on purchases = debits to GST Receivable (1300)
 */
export function calculateGstReturnFromLedger(
  businessId: string,
  period: GstPeriod,
  basis: "invoice" | "payments",
  gstRate: number
): GstReturnFromLedger | GstReturnEmpty {
  const db = getDb();

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

  if (!gstPayableAccount && !gstReceivableAccount) {
    return { empty: true, reason: "no_gst_accounts", basis };
  }

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

  if (entries.length === 0) {
    return { empty: true, reason: "no_entries_in_period", basis };
  }

  const entryIds = new Set(entries.map((e) => e.id));
  const entryMap = new Map(entries.map((e) => [e.id, e]));

  // Resolve contact + invoice context for entries with source_type="invoice"
  // or source_type="expense". One small lookup per source kind.
  const invoiceSourceIds = entries.filter((e) => e.source_type === "invoice" && e.source_id).map((e) => e.source_id!);
  const expenseSourceIds = entries.filter((e) => e.source_type === "expense" && e.source_id).map((e) => e.source_id!);
  const sourceContext = new Map<string, { invoiceNumber: string; contactName: string }>();

  if (invoiceSourceIds.length > 0) {
    const invs = db
      .select({
        id: schema.invoices.id,
        invoice_number: schema.invoices.invoice_number,
        contact_name: schema.contacts.name,
      })
      .from(schema.invoices)
      .innerJoin(schema.contacts, eq(schema.invoices.contact_id, schema.contacts.id))
      .where(eq(schema.invoices.business_id, businessId))
      .all();
    for (const inv of invs) {
      if (invoiceSourceIds.includes(inv.id)) {
        sourceContext.set(inv.id, {
          invoiceNumber: inv.invoice_number,
          contactName: safeDecrypt(inv.contact_name),
        });
      }
    }
  }
  if (expenseSourceIds.length > 0) {
    const exps = db
      .select({ id: schema.expenses.id, vendor: schema.expenses.vendor })
      .from(schema.expenses)
      .where(eq(schema.expenses.business_id, businessId))
      .all();
    for (const exp of exps) {
      if (expenseSourceIds.includes(exp.id)) {
        sourceContext.set(exp.id, {
          invoiceNumber: "",
          contactName: safeDecrypt(exp.vendor),
        });
      }
    }
  }

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

    const ctx = entry.source_id ? sourceContext.get(entry.source_id) : undefined;
    const description = entry.description;
    const contactName = ctx?.contactName ?? "";
    const invoiceNumber = ctx?.invoiceNumber || entry.source_id || "";

    if (line.account_id === gstPayableAccount?.id) {
      const gstAmount = line.credit - line.debit;
      gstOnSales += gstAmount;
      lineItems.push({
        description,
        contactName,
        invoiceNumber,
        type: "sales",
        amount: round2(gstAmount / gstRate),
        gst: round2(gstAmount),
      });
    } else if (line.account_id === gstReceivableAccount?.id) {
      const gstAmount = line.debit - line.credit;
      gstOnPurchases += gstAmount;
      lineItems.push({
        description,
        contactName,
        invoiceNumber,
        type: "purchases",
        amount: round2(gstAmount / gstRate),
        gst: round2(gstAmount),
      });
    }
  }

  const totalSales = round2(gstOnSales / gstRate);
  const totalPurchases = round2(gstOnPurchases / gstRate);

  const result: GstReturnFromLedger = {
    period,
    basis,
    gstRate,
    totalSales,
    totalPurchases,
    gstOnSales: round2(gstOnSales),
    gstOnPurchases: round2(gstOnPurchases),
    netGst: round2(gstOnSales - gstOnPurchases),
    lineItems,
  };

  if (basis === "payments") {
    result.basisCaveat =
      "Calculation uses accrual (invoice) treatment. True payments-basis support is tracked in audit #76 — for now this number reflects when invoices were posted, not when cash moved.";
  }

  return result;
}

/** Best-effort decryption — returns the raw value if decryption fails
 *  (e.g. test fixtures, plaintext historical rows). */
function safeDecrypt(s: string): string {
  try {
    // Lazy import to avoid pulling encryption into every consumer of this
    // calculator — most of which are pure / test paths.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { decrypt } = require("@/lib/encryption") as typeof import("@/lib/encryption");
    return decrypt(s);
  } catch {
    return s;
  }
}
