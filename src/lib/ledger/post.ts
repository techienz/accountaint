import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getAccountByCode } from "./accounts";
import { createJournalEntry, hasJournalForSource, reverseJournalEntry } from "./journals";
import { getExpenseAccountCode, SYSTEM_ACCOUNTS } from "./account-mapping";
import type { JournalLineInput } from "./types";
import { getStandardGstRate } from "@/lib/tax/rules";

function requireAccount(businessId: string, code: string): string {
  const account = getAccountByCode(businessId, code);
  if (!account) throw new Error(`Account ${code} not found for business ${businessId}`);
  return account.id;
}

/**
 * Post journal entry for a sales invoice (ACCREC) being sent.
 * DR Accounts Receivable (total incl GST)
 * CR Sales Revenue (subtotal ex GST)
 * CR GST Payable (GST amount)
 */
export function postSalesInvoiceJournal(businessId: string, invoice: {
  id: string;
  date: string;
  invoice_number: string;
  subtotal: number;
  gst_total: number;
  total: number;
  contact_id: string | null;
}): string | null {
  if (hasJournalForSource(businessId, "invoice", invoice.id)) return null;

  const arId = requireAccount(businessId, SYSTEM_ACCOUNTS.ACCOUNTS_RECEIVABLE);
  const revenueId = requireAccount(businessId, SYSTEM_ACCOUNTS.SALES_REVENUE);
  const gstPayableId = requireAccount(businessId, SYSTEM_ACCOUNTS.GST_PAYABLE);

  const lines: JournalLineInput[] = [
    { account_id: arId, debit: invoice.total, credit: 0, contact_id: invoice.contact_id ?? undefined },
    { account_id: revenueId, debit: 0, credit: invoice.subtotal },
  ];

  if (invoice.gst_total > 0) {
    lines.push({
      account_id: gstPayableId,
      debit: 0,
      credit: invoice.gst_total,
      gst_amount: invoice.gst_total,
      gst_rate: getStandardGstRate(invoice.date),
    });
  }

  return createJournalEntry(businessId, {
    date: invoice.date,
    description: `Sales invoice ${invoice.invoice_number}`,
    source_type: "invoice",
    source_id: invoice.id,
    lines,
  });
}

/**
 * Post journal entry for a purchase invoice (ACCPAY) being sent.
 * DR Expense account (subtotal ex GST) — uses account_code from line items or defaults
 * DR GST Receivable (GST amount)
 * CR Accounts Payable (total incl GST)
 */
export function postPurchaseInvoiceJournal(businessId: string, invoice: {
  id: string;
  date: string;
  invoice_number: string;
  subtotal: number;
  gst_total: number;
  total: number;
  contact_id: string | null;
}, lineItems: Array<{ account_code: string | null; line_total: number; gst_amount: number }>): string | null {
  if (hasJournalForSource(businessId, "invoice", invoice.id)) return null;

  const apId = requireAccount(businessId, SYSTEM_ACCOUNTS.ACCOUNTS_PAYABLE);
  const gstReceivableId = requireAccount(businessId, SYSTEM_ACCOUNTS.GST_RECEIVABLE);

  const lines: JournalLineInput[] = [];

  // Group line items by account code for cleaner journals
  const byAccount = new Map<string, number>();
  for (const item of lineItems) {
    const code = item.account_code || SYSTEM_ACCOUNTS.OTHER_EXPENSES;
    byAccount.set(code, (byAccount.get(code) ?? 0) + item.line_total);
  }

  for (const [code, amount] of byAccount) {
    const accountId = requireAccount(businessId, code);
    lines.push({ account_id: accountId, debit: amount, credit: 0 });
  }

  if (invoice.gst_total > 0) {
    lines.push({
      account_id: gstReceivableId,
      debit: invoice.gst_total,
      credit: 0,
      gst_amount: invoice.gst_total,
      gst_rate: getStandardGstRate(invoice.date),
    });
  }

  lines.push({
    account_id: apId,
    debit: 0,
    credit: invoice.total,
    contact_id: invoice.contact_id ?? undefined,
  });

  return createJournalEntry(businessId, {
    date: invoice.date,
    description: `Purchase invoice ${invoice.invoice_number}`,
    source_type: "invoice",
    source_id: invoice.id,
    lines,
  });
}

/**
 * Post journal entry for a payment received (against ACCREC invoice).
 * DR Cash at Bank
 * CR Accounts Receivable
 */
export function postPaymentReceivedJournal(businessId: string, payment: {
  id: string;
  date: string;
  amount: number;
  invoice_id: string;
  contact_id?: string | null;
}): string | null {
  if (hasJournalForSource(businessId, "payment", payment.id)) return null;

  const bankId = requireAccount(businessId, SYSTEM_ACCOUNTS.CASH_AT_BANK);
  const arId = requireAccount(businessId, SYSTEM_ACCOUNTS.ACCOUNTS_RECEIVABLE);

  return createJournalEntry(businessId, {
    date: payment.date,
    description: `Payment received`,
    source_type: "payment",
    source_id: payment.id,
    lines: [
      { account_id: bankId, debit: payment.amount, credit: 0 },
      { account_id: arId, debit: 0, credit: payment.amount, contact_id: payment.contact_id ?? undefined },
    ],
  });
}

/**
 * Post journal entry for a payment made (against ACCPAY invoice).
 * DR Accounts Payable
 * CR Cash at Bank
 */
export function postPaymentMadeJournal(businessId: string, payment: {
  id: string;
  date: string;
  amount: number;
  invoice_id: string;
  contact_id?: string | null;
}): string | null {
  if (hasJournalForSource(businessId, "payment", payment.id)) return null;

  const bankId = requireAccount(businessId, SYSTEM_ACCOUNTS.CASH_AT_BANK);
  const apId = requireAccount(businessId, SYSTEM_ACCOUNTS.ACCOUNTS_PAYABLE);

  return createJournalEntry(businessId, {
    date: payment.date,
    description: `Payment made`,
    source_type: "payment",
    source_id: payment.id,
    lines: [
      { account_id: apId, debit: payment.amount, credit: 0, contact_id: payment.contact_id ?? undefined },
      { account_id: bankId, debit: 0, credit: payment.amount },
    ],
  });
}

/**
 * Post journal entry for a confirmed expense (paid directly, not via invoice).
 * DR Expense account (amount ex GST)
 * DR GST Receivable (GST amount)
 * CR Cash at Bank (total amount)
 */
export function postExpenseJournal(businessId: string, expense: {
  id: string;
  date: string;
  category: string;
  amount: number; // GST-inclusive
  gst_amount: number | null;
  vendor?: string;
}): string | null {
  if (hasJournalForSource(businessId, "expense", expense.id)) return null;

  const expenseCode = getExpenseAccountCode(expense.category);
  const expenseAccountId = requireAccount(businessId, expenseCode);
  const bankId = requireAccount(businessId, SYSTEM_ACCOUNTS.CASH_AT_BANK);

  const gst = expense.gst_amount ?? 0;
  const exGst = expense.amount - gst;

  const lines: JournalLineInput[] = [
    { account_id: expenseAccountId, debit: exGst, credit: 0 },
  ];

  if (gst > 0) {
    const gstReceivableId = requireAccount(businessId, SYSTEM_ACCOUNTS.GST_RECEIVABLE);
    lines.push({
      account_id: gstReceivableId,
      debit: gst,
      credit: 0,
      gst_amount: gst,
      gst_rate: getStandardGstRate(expense.date),
    });
  }

  lines.push({ account_id: bankId, debit: 0, credit: expense.amount });

  return createJournalEntry(businessId, {
    date: expense.date,
    description: `Expense: ${expense.vendor ?? expense.category}`,
    source_type: "expense",
    source_id: expense.id,
    lines,
  });
}

/**
 * Post journal entry for annual depreciation on an asset.
 * DR Depreciation Expense
 * CR Accumulated Depreciation
 */
export function postDepreciationJournal(businessId: string, depRecord: {
  id: string;
  tax_year: string;
  depreciation_amount: number;
  asset_name?: string;
}): string | null {
  if (hasJournalForSource(businessId, "depreciation", depRecord.id)) return null;
  if (depRecord.depreciation_amount <= 0) return null;

  const depExpenseId = requireAccount(businessId, SYSTEM_ACCOUNTS.DEPRECIATION_EXPENSE);
  const accumDepId = requireAccount(businessId, SYSTEM_ACCOUNTS.ACCUMULATED_DEPRECIATION);

  // Use March 31 of the tax year as the journal date
  const date = `${depRecord.tax_year}-03-31`;

  return createJournalEntry(businessId, {
    date,
    description: `Depreciation: ${depRecord.asset_name ?? "asset"} (${depRecord.tax_year})`,
    source_type: "depreciation",
    source_id: depRecord.id,
    lines: [
      { account_id: depExpenseId, debit: depRecord.depreciation_amount, credit: 0 },
      { account_id: accumDepId, debit: 0, credit: depRecord.depreciation_amount },
    ],
  });
}

/**
 * Post journal entry for a shareholder transaction.
 * Drawing:    DR Shareholder CA / CR Bank
 * Repayment:  DR Bank / CR Shareholder CA
 * Salary:     DR Salaries & Wages / CR Shareholder CA
 * Dividend:   DR Retained Earnings / CR Shareholder CA
 */
export function postShareholderJournal(businessId: string, txn: {
  id: string;
  date: string;
  type: "drawing" | "repayment" | "salary" | "dividend" | "other";
  amount: number; // positive = drawing/debit, negative = credit/repayment
  description?: string;
}): string | null {
  if (hasJournalForSource(businessId, "shareholder", txn.id)) return null;

  const shareholderCAId = requireAccount(businessId, SYSTEM_ACCOUNTS.SHAREHOLDER_CURRENT_ACCOUNT);
  const bankId = requireAccount(businessId, SYSTEM_ACCOUNTS.CASH_AT_BANK);
  const absAmount = Math.abs(txn.amount);

  if (absAmount === 0) return null;

  const lines: JournalLineInput[] = [];

  switch (txn.type) {
    case "drawing":
      lines.push(
        { account_id: shareholderCAId, debit: absAmount, credit: 0 },
        { account_id: bankId, debit: 0, credit: absAmount }
      );
      break;
    case "repayment":
      lines.push(
        { account_id: bankId, debit: absAmount, credit: 0 },
        { account_id: shareholderCAId, debit: 0, credit: absAmount }
      );
      break;
    case "salary": {
      const salaryId = requireAccount(businessId, SYSTEM_ACCOUNTS.SALARIES_WAGES);
      lines.push(
        { account_id: salaryId, debit: absAmount, credit: 0 },
        { account_id: shareholderCAId, debit: 0, credit: absAmount }
      );
      break;
    }
    case "dividend": {
      const retainedId = getAccountByCode(businessId, "3200");
      if (!retainedId) throw new Error("Retained Earnings account not found");
      lines.push(
        { account_id: retainedId.id, debit: absAmount, credit: 0 },
        { account_id: shareholderCAId, debit: 0, credit: absAmount }
      );
      break;
    }
    default:
      // "other" — treat like drawing if positive, repayment if negative
      if (txn.amount > 0) {
        lines.push(
          { account_id: shareholderCAId, debit: absAmount, credit: 0 },
          { account_id: bankId, debit: 0, credit: absAmount }
        );
      } else {
        lines.push(
          { account_id: bankId, debit: absAmount, credit: 0 },
          { account_id: shareholderCAId, debit: 0, credit: absAmount }
        );
      }
  }

  return createJournalEntry(businessId, {
    date: txn.date,
    description: txn.description ?? `Shareholder ${txn.type}`,
    source_type: "shareholder",
    source_id: txn.id,
    lines,
  });
}

/**
 * Reverse a journal entry for an invoice being voided.
 */
export function postInvoiceReversal(businessId: string, invoiceId: string, date: string): string | null {
  const db = getDb();
  const entry = db
    .select()
    .from(schema.journalEntries)
    .where(eq(schema.journalEntries.source_id, invoiceId))
    .all()
    .find((e) => e.source_type === "invoice" && !e.is_reversed && e.business_id === businessId);

  if (!entry) return null;
  return reverseJournalEntry(businessId, entry.id, date);
}
