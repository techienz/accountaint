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
  /** Optional caveat shown to the user when the result has known limitations
   *  (e.g. payment without a matched invoice). Empty under normal operation. */
  basisCaveat?: string;
};

/**
 * Snapshot of ledger data needed to compute a GST return. Extracted as a
 * separate type so the math can be unit-tested without a database — the
 * DB-aware wrapper builds this snapshot, the pure helper crunches it.
 */
export type GstLedgerSnapshot = {
  entries: Array<{
    id: string;
    date: string;
    description: string;
    source_type: string;
    source_id: string | null;
  }>;
  lines: Array<{
    journal_entry_id: string;
    account_id: string;
    debit: number;
    credit: number;
  }>;
  /** All payments for the business (we filter by date inside the helper). */
  payments: Array<{
    id: string;
    invoice_id: string;
    date: string;
    amount: number;
  }>;
  /** Invoices referenced by either invoice journals or payment journals. */
  invoices: Array<{
    id: string;
    invoice_number: string;
    type: "ACCREC" | "ACCPAY";
    total: number;
    gst_total: number;
    contact_name: string;
  }>;
  /** Expenses referenced by expense journals (for line-item labelling). */
  expenses: Array<{ id: string; vendor: string }>;
  /** Account 2200, or null if not configured. */
  gstPayableAccountId: string | null;
  /** Account 1300, or null if not configured. */
  gstReceivableAccountId: string | null;
};

/**
 * Calculate GST return from journal entries. Replaces the older
 * invoice-only `calculateGstReturn` for the /tax-prep/gst flow + the
 * `calculate_gst_return` chat tool. Audit #115.
 *
 * Captures, on both bases:
 * - Confirmed expenses entered without an invoice (cash-out at posting)
 * - Manual GST adjustment journals
 * - Any other bookkeeping that posts to the GST accounts directly
 *
 * Bases (per IR365 — Accounting basis; GST Act 1985 s 9 Time of supply):
 * - **Invoice basis** — GST recognised when an invoice is issued/received.
 *   Sums credits to GST Payable (2200) and debits to GST Receivable (1300)
 *   across all in-period entries.
 * - **Payments basis** — GST recognised when cash moves. Skips invoice
 *   journals; for each payment journal in the period, derives proportional
 *   GST from the linked invoice (`payment.amount × invoice.gst_total /
 *   invoice.total`); other entries (expense, manual, adjustment, etc.) are
 *   treated like invoice basis since they post directly against the GST
 *   accounts at the time the cash event was recorded.
 *
 * Eligibility for payments basis (IR365): turnover under $2 million.
 * The calculator does not enforce this — eligibility is the user's decision
 * and is set on the business record.
 *
 * Contact + invoice context is resolved from journal source_type/source_id
 * via small joins so the worksheet drilldown shows useful labels rather
 * than raw entry descriptions.
 */
export function calculateGstReturnFromLedger(
  businessId: string,
  period: GstPeriod,
  basis: "invoice" | "payments",
  gstRate: number
): GstReturnFromLedger | GstReturnEmpty {
  const snapshot = loadLedgerSnapshot(businessId, period);
  return computeGstReturnFromSnapshot(snapshot, period, basis, gstRate);
}

function loadLedgerSnapshot(businessId: string, period: GstPeriod): GstLedgerSnapshot {
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

  // In-period posted entries.
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

  const entryIds = new Set(entries.map((e) => e.id));
  const allLines = db.select().from(schema.journalLines).all();
  const lines = allLines.filter((l) => entryIds.has(l.journal_entry_id));

  // Payments — keyed by id for lookup. Filtering by date happens in the
  // helper so the snapshot is not coupled to the period boundaries beyond
  // the entries themselves.
  const allPayments = db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.business_id, businessId))
    .all();

  // Pull invoices we'll need: any referenced by an invoice OR payment journal.
  const invoiceJournalSourceIds = entries
    .filter((e) => e.source_type === "invoice" && e.source_id)
    .map((e) => e.source_id!);
  const paymentJournalSourceIds = entries
    .filter((e) => e.source_type === "payment" && e.source_id)
    .map((e) => e.source_id!);
  const paymentLinkedInvoiceIds = allPayments
    .filter((p) => paymentJournalSourceIds.includes(p.id))
    .map((p) => p.invoice_id);
  const wantedInvoiceIds = new Set([...invoiceJournalSourceIds, ...paymentLinkedInvoiceIds]);

  const invoiceRows = wantedInvoiceIds.size
    ? db
        .select({
          id: schema.invoices.id,
          invoice_number: schema.invoices.invoice_number,
          type: schema.invoices.type,
          total: schema.invoices.total,
          gst_total: schema.invoices.gst_total,
          contact_name: schema.contacts.name,
        })
        .from(schema.invoices)
        .innerJoin(schema.contacts, eq(schema.invoices.contact_id, schema.contacts.id))
        .where(eq(schema.invoices.business_id, businessId))
        .all()
        .filter((inv) => wantedInvoiceIds.has(inv.id))
        .map((inv) => ({
          ...inv,
          contact_name: safeDecrypt(inv.contact_name),
        }))
    : [];

  const expenseSourceIds = entries
    .filter((e) => e.source_type === "expense" && e.source_id)
    .map((e) => e.source_id!);
  const expenseRows = expenseSourceIds.length
    ? db
        .select({ id: schema.expenses.id, vendor: schema.expenses.vendor })
        .from(schema.expenses)
        .where(eq(schema.expenses.business_id, businessId))
        .all()
        .filter((exp) => expenseSourceIds.includes(exp.id))
        .map((exp) => ({ ...exp, vendor: safeDecrypt(exp.vendor) }))
    : [];

  return {
    entries: entries.map((e) => ({
      id: e.id,
      date: e.date,
      description: e.description,
      source_type: e.source_type,
      source_id: e.source_id,
    })),
    lines: lines.map((l) => ({
      journal_entry_id: l.journal_entry_id,
      account_id: l.account_id,
      debit: l.debit,
      credit: l.credit,
    })),
    payments: allPayments.map((p) => ({
      id: p.id,
      invoice_id: p.invoice_id,
      date: p.date,
      amount: p.amount,
    })),
    invoices: invoiceRows,
    expenses: expenseRows,
    gstPayableAccountId: gstPayableAccount?.id ?? null,
    gstReceivableAccountId: gstReceivableAccount?.id ?? null,
  };
}

/**
 * Pure GST-return computation from a ledger snapshot. No DB access — all
 * inputs come in via `snap`. Exported for unit testing both basis paths
 * without a test-DB harness.
 */
export function computeGstReturnFromSnapshot(
  snap: GstLedgerSnapshot,
  period: GstPeriod,
  basis: "invoice" | "payments",
  gstRate: number
): GstReturnFromLedger | GstReturnEmpty {
  if (!snap.gstPayableAccountId && !snap.gstReceivableAccountId) {
    return { empty: true, reason: "no_gst_accounts", basis };
  }
  if (snap.entries.length === 0) {
    return { empty: true, reason: "no_entries_in_period", basis };
  }

  const invoiceById = new Map(snap.invoices.map((inv) => [inv.id, inv]));
  const paymentById = new Map(snap.payments.map((p) => [p.id, p]));
  const expenseById = new Map(snap.expenses.map((e) => [e.id, e]));
  const linesByEntry = new Map<string, typeof snap.lines>();
  for (const line of snap.lines) {
    const arr = linesByEntry.get(line.journal_entry_id) ?? [];
    arr.push(line);
    linesByEntry.set(line.journal_entry_id, arr);
  }

  let gstOnSales = 0;
  let gstOnPurchases = 0;
  const lineItems: GstLineItem[] = [];
  let unmatchedPayments = 0;

  for (const entry of snap.entries) {
    // Invoice basis: every entry contributes via its GST account postings.
    // Payments basis: invoice journals are deferred to the payment date,
    // so we skip them here (their GST is recognised when payment posts).
    if (basis === "payments" && entry.source_type === "invoice") {
      continue;
    }

    if (basis === "payments" && entry.source_type === "payment" && entry.source_id) {
      // Payments basis: derive GST proportionally from the linked invoice.
      // IR365 — Accounting basis (Payments): GST is recognised when payment
      // is received (sales) or made (purchases). Per GST Act 1985 s 9(2)(b)
      // (time of supply on payments basis), recognition tracks cash, not
      // posting. We compute the GST share = paymentAmount × gstTotal/total
      // so partial payments recognise proportional GST.
      const payment = paymentById.get(entry.source_id);
      if (!payment) {
        unmatchedPayments++;
        continue;
      }
      const invoice = invoiceById.get(payment.invoice_id);
      if (!invoice) {
        unmatchedPayments++;
        continue;
      }
      if (invoice.total <= 0 || invoice.gst_total <= 0) {
        // Zero-rated or zero-total — no GST contribution from this payment.
        continue;
      }
      const gstShare = (payment.amount * invoice.gst_total) / invoice.total;
      const exGstShare = payment.amount - gstShare;
      const isSales = invoice.type === "ACCREC";
      if (isSales) {
        gstOnSales += gstShare;
      } else {
        gstOnPurchases += gstShare;
      }
      lineItems.push({
        description: `Payment for ${invoice.invoice_number}`,
        contactName: invoice.contact_name ?? "",
        invoiceNumber: invoice.invoice_number,
        type: isSales ? "sales" : "purchases",
        amount: round2(exGstShare),
        gst: round2(gstShare),
      });
      continue;
    }

    // All other entry kinds (and invoice-basis path): walk the GST account
    // lines on this entry. Direct expenses, manual adjustments, payroll
    // GST (rare), depreciation (no GST), etc. are recognised at posting.
    // For invoice basis this also covers invoice journals — credits to GST
    // Payable are sales GST, debits to GST Receivable are purchases GST.
    const lines = linesByEntry.get(entry.id) ?? [];
    const ctx = resolveContext(entry, invoiceById, expenseById);

    for (const line of lines) {
      if (snap.gstPayableAccountId && line.account_id === snap.gstPayableAccountId) {
        const gstAmount = line.credit - line.debit;
        if (gstAmount === 0) continue;
        gstOnSales += gstAmount;
        lineItems.push({
          description: entry.description,
          contactName: ctx.contactName,
          invoiceNumber: ctx.invoiceNumber,
          type: "sales",
          amount: round2(gstAmount / gstRate),
          gst: round2(gstAmount),
        });
      } else if (snap.gstReceivableAccountId && line.account_id === snap.gstReceivableAccountId) {
        const gstAmount = line.debit - line.credit;
        if (gstAmount === 0) continue;
        gstOnPurchases += gstAmount;
        lineItems.push({
          description: entry.description,
          contactName: ctx.contactName,
          invoiceNumber: ctx.invoiceNumber,
          type: "purchases",
          amount: round2(gstAmount / gstRate),
          gst: round2(gstAmount),
        });
      }
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

  // Surfaces a real data-integrity caveat when payment journals couldn't be
  // matched to an invoice. Under normal operation this stays empty — the
  // basis label alone tells the user which method was used.
  if (basis === "payments" && unmatchedPayments > 0) {
    result.basisCaveat = `${unmatchedPayments} payment ${
      unmatchedPayments === 1 ? "entry was" : "entries were"
    } skipped because the linked invoice could not be found. Check the journal source links.`;
  }

  // The lineItems-empty case can occur on payments basis when only invoice
  // journals exist in the period (no payments, no expenses, no manual
  // adjustments). We return an empty-result instead of zeros so the UI can
  // render the same "nothing to declare" path as on invoice basis.
  if (lineItems.length === 0 && gstOnSales === 0 && gstOnPurchases === 0) {
    return { empty: true, reason: "no_entries_in_period", basis };
  }

  return result;
}

function resolveContext(
  entry: { source_type: string; source_id: string | null },
  invoiceById: Map<string, { invoice_number: string; contact_name: string }>,
  expenseById: Map<string, { vendor: string }>
): { invoiceNumber: string; contactName: string } {
  if (entry.source_type === "invoice" && entry.source_id) {
    const inv = invoiceById.get(entry.source_id);
    if (inv) return { invoiceNumber: inv.invoice_number, contactName: inv.contact_name ?? "" };
  }
  if (entry.source_type === "expense" && entry.source_id) {
    const exp = expenseById.get(entry.source_id);
    if (exp) return { invoiceNumber: "", contactName: exp.vendor };
  }
  return { invoiceNumber: entry.source_id ?? "", contactName: "" };
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
