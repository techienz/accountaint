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

/**
 * Filing basis. Maps to the IR365 accounting bases (s 19 GST Act 1985):
 * - "invoice"  → recognise GST when invoice issued/received
 * - "payments" → recognise GST when cash moves
 * - "hybrid"   → invoice basis for sales, payments basis for purchases
 */
export type GstBasis = "invoice" | "payments" | "hybrid";

export type GstReturnResult = {
  period: GstPeriod;
  basis: GstBasis;
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
  basis: GstBasis;
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
 * `calculate_gst_return` chat tool. Audit #115 / #76.
 *
 * Captures, on every basis:
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
 * - **Hybrid basis** — invoice basis for sales, payments basis for
 *   purchases. ACCREC invoice journals contribute sales GST at posting;
 *   ACCREC payment journals are skipped. ACCPAY invoice journals are
 *   skipped; ACCPAY payment journals contribute purchases GST
 *   proportionally. Direct expenses + manual journals contribute as
 *   posted (cash-realised at posting under all bases).
 *
 * Eligibility for payments / hybrid basis (IR365): turnover under
 * $2 million. The calculator does not enforce this — eligibility is the
 * user's decision and is set on the business record.
 *
 * Contact + invoice context is resolved from journal source_type/source_id
 * via small joins so the worksheet drilldown shows useful labels rather
 * than raw entry descriptions.
 */
export function calculateGstReturnFromLedger(
  businessId: string,
  period: GstPeriod,
  basis: GstBasis,
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
  basis: GstBasis,
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

  // Sales-side timing: invoice basis uses invoice posting; payments basis
  // uses cash receipt; hybrid uses invoice posting (sales = invoice basis).
  const salesUsesPaymentsTiming = basis === "payments";
  // Purchases-side timing: invoice basis uses invoice posting; payments
  // basis and hybrid both use cash payment.
  const purchasesUsesPaymentsTiming = basis === "payments" || basis === "hybrid";

  let gstOnSales = 0;
  let gstOnPurchases = 0;
  let totalSales = 0;
  let totalPurchases = 0;
  const lineItems: GstLineItem[] = [];
  let unmatchedPayments = 0;

  for (const entry of snap.entries) {
    // ----- Invoice journals -------------------------------------------------
    // For each side that uses payments timing, the invoice posting is deferred
    // to its payment journal. We may still need the OTHER side from the same
    // invoice journal (e.g. hybrid: keep ACCREC sales, defer ACCPAY purchases).
    if (entry.source_type === "invoice") {
      const inv = entry.source_id ? invoiceById.get(entry.source_id) : undefined;
      // Without the source invoice we can't tell ACCREC vs ACCPAY for hybrid.
      // Fall back to invoice-basis treatment (walk all GST lines) — the user
      // sees a slight over-count but won't silently lose GST.
      if (inv) {
        const isSales = inv.type === "ACCREC";
        if (isSales && salesUsesPaymentsTiming) continue;
        if (!isSales && purchasesUsesPaymentsTiming) continue;
      }
      // Otherwise fall through to the GST-account-line walk below.
    }

    // ----- Payment journals -------------------------------------------------
    // Recognise GST proportionally on whichever side uses payments timing.
    if (entry.source_type === "payment" && entry.source_id) {
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
      const isSales = invoice.type === "ACCREC";
      const sideUsesPayments = isSales ? salesUsesPaymentsTiming : purchasesUsesPaymentsTiming;
      if (!sideUsesPayments) continue; // Already recognised at invoice posting on this basis.
      if (invoice.total <= 0 || invoice.gst_total <= 0) {
        // Zero-rated or zero-total — no GST contribution from this payment.
        // Box 5 (standard) / Box 6 (zero-rated) split is tracked separately
        // in #141 — this branch keeps zero-rated out of GST totals correctly
        // but does not yet contribute to a Box 6 total.
        continue;
      }
      // IR365 — Accounting basis (Payments / Hybrid): GST is recognised when
      // payment is received (sales) or made (purchases). Per GST Act 1985
      // s 9(2)(b) (time of supply on payments basis), recognition tracks cash,
      // not posting. GST share = payment × invoice.gst_total / invoice.total
      // — partial payments recognise proportional GST.
      const gstShare = (payment.amount * invoice.gst_total) / invoice.total;
      const exGstShare = payment.amount - gstShare;
      if (isSales) {
        gstOnSales += gstShare;
        totalSales += exGstShare;
      } else {
        gstOnPurchases += gstShare;
        totalPurchases += exGstShare;
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

    // ----- All other entries (expense, manual, adjustment, etc.) -----------
    // These post to the GST accounts at the time of the cash event (direct
    // expenses) or as user-discretion adjustments (manual journals). They
    // are recognised at posting on every basis. We also reach this branch
    // for invoice journals on a side that uses invoice-basis timing.
    const lines = linesByEntry.get(entry.id) ?? [];
    const ctx = resolveContext(entry, invoiceById, expenseById);

    // For invoice journals we know the invoice subtotal exactly — prefer that
    // over back-derivation so mixed-rate or rounded-cents totals don't drift.
    const invForEntry = entry.source_type === "invoice" && entry.source_id
      ? invoiceById.get(entry.source_id)
      : undefined;

    for (const line of lines) {
      if (snap.gstPayableAccountId && line.account_id === snap.gstPayableAccountId) {
        const gstAmount = line.credit - line.debit;
        if (gstAmount === 0) continue;
        gstOnSales += gstAmount;
        const exGst = invForEntry && invForEntry.type === "ACCREC"
          ? invForEntry.total - invForEntry.gst_total
          : gstAmount / gstRate;
        totalSales += exGst;
        lineItems.push({
          description: entry.description,
          contactName: ctx.contactName,
          invoiceNumber: ctx.invoiceNumber,
          type: "sales",
          amount: round2(exGst),
          gst: round2(gstAmount),
        });
      } else if (snap.gstReceivableAccountId && line.account_id === snap.gstReceivableAccountId) {
        const gstAmount = line.debit - line.credit;
        if (gstAmount === 0) continue;
        gstOnPurchases += gstAmount;
        const exGst = invForEntry && invForEntry.type === "ACCPAY"
          ? invForEntry.total - invForEntry.gst_total
          : gstAmount / gstRate;
        totalPurchases += exGst;
        lineItems.push({
          description: entry.description,
          contactName: ctx.contactName,
          invoiceNumber: ctx.invoiceNumber,
          type: "purchases",
          amount: round2(exGst),
          gst: round2(gstAmount),
        });
      }
    }
  }

  const result: GstReturnFromLedger = {
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

  // Surfaces a real data-integrity caveat when payment journals couldn't be
  // matched to an invoice. Under normal operation this stays empty — the
  // basis label alone tells the user which method was used.
  if (purchasesUsesPaymentsTiming || salesUsesPaymentsTiming) {
    if (unmatchedPayments > 0) {
      result.basisCaveat = `${unmatchedPayments} payment ${
        unmatchedPayments === 1 ? "entry was" : "entries were"
      } skipped because the linked invoice could not be found. Check the journal source links.`;
    }
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
