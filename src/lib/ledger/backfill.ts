import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { seedChartOfAccounts, hasChartOfAccounts } from "./accounts";
import {
  postSalesInvoiceJournal,
  postPurchaseInvoiceJournal,
  postPaymentReceivedJournal,
  postPaymentMadeJournal,
  postExpenseJournal,
  postDepreciationJournal,
  postShareholderJournal,
} from "./post";

export type BackfillResult = {
  coaSeeded: boolean;
  invoices: number;
  payments: number;
  expenses: number;
  depreciation: number;
  shareholders: number;
  errors: string[];
};

/**
 * Backfill journal entries for all existing financial records.
 * Seeds the COA first if not already present.
 * Idempotent — skips records that already have journal entries (via source_type + source_id dedup).
 */
export function backfillJournals(businessId: string): BackfillResult {
  const result: BackfillResult = {
    coaSeeded: false,
    invoices: 0,
    payments: 0,
    expenses: 0,
    depreciation: 0,
    shareholders: 0,
    errors: [],
  };

  // Ensure COA exists
  if (!hasChartOfAccounts(businessId)) {
    seedChartOfAccounts(businessId);
    result.coaSeeded = true;
  }

  const db = getDb();

  // Backfill invoices (sent, paid, overdue — not draft or void)
  const invoices = db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.business_id, businessId))
    .all()
    .filter((i) => i.status !== "draft" && i.status !== "void");

  for (const inv of invoices) {
    try {
      if (inv.type === "ACCREC") {
        if (postSalesInvoiceJournal(businessId, inv)) result.invoices++;
      } else {
        const lineItems = db
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoice_id, inv.id))
          .all();
        if (postPurchaseInvoiceJournal(businessId, inv, lineItems)) result.invoices++;
      }
    } catch (e) {
      result.errors.push(`Invoice ${inv.invoice_number}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Backfill payments
  const payments = db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.business_id, businessId))
    .all();

  for (const pmt of payments) {
    try {
      const invoice = db
        .select()
        .from(schema.invoices)
        .where(eq(schema.invoices.id, pmt.invoice_id))
        .get();
      if (!invoice) continue;

      const postFn = invoice.type === "ACCREC" ? postPaymentReceivedJournal : postPaymentMadeJournal;
      if (postFn(businessId, {
        id: pmt.id,
        date: pmt.date,
        amount: pmt.amount,
        invoice_id: pmt.invoice_id,
        contact_id: invoice.contact_id,
      })) {
        result.payments++;
      }
    } catch (e) {
      result.errors.push(`Payment ${pmt.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Backfill confirmed expenses
  const expenses = db
    .select()
    .from(schema.expenses)
    .where(eq(schema.expenses.business_id, businessId))
    .all()
    .filter((e) => e.status === "confirmed");

  for (const exp of expenses) {
    try {
      if (postExpenseJournal(businessId, {
        id: exp.id,
        date: exp.date,
        category: exp.category,
        amount: exp.amount,
        gst_amount: exp.gst_amount,
        vendor: decrypt(exp.vendor),
      })) {
        result.expenses++;
      }
    } catch (e) {
      result.errors.push(`Expense ${exp.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Backfill depreciation records
  const depRecords = db
    .select()
    .from(schema.assetDepreciation)
    .where(eq(schema.assetDepreciation.business_id, businessId))
    .all();

  for (const dep of depRecords) {
    try {
      const asset = db
        .select()
        .from(schema.assets)
        .where(eq(schema.assets.id, dep.asset_id))
        .get();

      if (postDepreciationJournal(businessId, {
        id: dep.id,
        tax_year: dep.tax_year,
        depreciation_amount: dep.depreciation_amount,
        asset_name: asset?.name,
      })) {
        result.depreciation++;
      }
    } catch (e) {
      result.errors.push(`Depreciation ${dep.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Backfill shareholder transactions
  const shTxns = db
    .select()
    .from(schema.shareholderTransactions)
    .where(eq(schema.shareholderTransactions.business_id, businessId))
    .all();

  for (const txn of shTxns) {
    try {
      if (postShareholderJournal(businessId, {
        id: txn.id,
        date: txn.date,
        type: txn.type as "drawing" | "repayment" | "salary" | "dividend" | "other",
        amount: txn.amount,
        description: txn.description ?? undefined,
      })) {
        result.shareholders++;
      }
    } catch (e) {
      result.errors.push(`Shareholder txn ${txn.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}
