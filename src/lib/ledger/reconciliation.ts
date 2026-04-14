import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { createJournalEntry } from "./journals";
import { getAccountByCode } from "./accounts";
import { getExpenseAccountCode, SYSTEM_ACCOUNTS } from "./account-mapping";
import type { JournalLineInput } from "./types";

export type MatchSuggestion = {
  journal_entry_id: string;
  entry_number: number;
  date: string;
  description: string;
  amount: number;
  confidence: "high" | "medium" | "low";
};

export type LinkedInvoiceInfo = {
  invoiceId: string;
  invoiceNumber: string;
  contactName: string | null;
  amount: number;
  markedPaid: boolean;
};

export type ReconciliationStatus = {
  totalTransactions: number;
  matched: number;
  reconciled: number;
  unmatched: number;
  excluded: number;
  bankBalance: number | null;
  ledgerBalance: number;
};

/**
 * Suggest journal entry matches for a bank transaction.
 * Matches by amount and date proximity (within 3 days).
 */
export function suggestMatches(
  businessId: string,
  bankTransactionId: string
): MatchSuggestion[] {
  const db = getDb();

  const txn = db
    .select()
    .from(schema.bankTransactions)
    .where(
      and(
        eq(schema.bankTransactions.id, bankTransactionId),
        eq(schema.bankTransactions.business_id, businessId)
      )
    )
    .get();

  if (!txn) return [];

  // Get the bank account's ledger account
  const akahuAccount = db
    .select()
    .from(schema.akahuAccounts)
    .where(eq(schema.akahuAccounts.id, txn.akahu_account_id))
    .get();

  const ledgerAccountId = akahuAccount?.linked_ledger_account_id;
  if (!ledgerAccountId) return [];

  // Get all unmatched journal entries that hit this bank account
  const allEntries = db
    .select()
    .from(schema.journalEntries)
    .where(
      and(
        eq(schema.journalEntries.business_id, businessId),
        eq(schema.journalEntries.is_posted, true),
        eq(schema.journalEntries.is_reversed, false)
      )
    )
    .all();

  const allLines = db
    .select()
    .from(schema.journalLines)
    .where(eq(schema.journalLines.account_id, ledgerAccountId))
    .all();

  const entryMap = new Map(allEntries.map((e) => [e.id, e]));

  // Find already-matched journal entry IDs
  const matchedEntryIds = new Set(
    db
      .select({ id: schema.bankTransactions.matched_journal_entry_id })
      .from(schema.bankTransactions)
      .where(eq(schema.bankTransactions.business_id, businessId))
      .all()
      .filter((r) => r.id)
      .map((r) => r.id!)
  );

  const txnAmount = txn.amount;
  const txnDate = new Date(txn.date);

  const suggestions: MatchSuggestion[] = [];

  for (const line of allLines) {
    const entry = entryMap.get(line.journal_entry_id);
    if (!entry) continue;
    if (matchedEntryIds.has(entry.id)) continue;

    // Calculate the net amount hitting the bank account
    // Debit to bank = money in (positive), Credit to bank = money out (negative)
    const lineAmount = line.debit - line.credit;

    // Amount match (within 1 cent)
    if (Math.abs(lineAmount - txnAmount) > 0.01) continue;

    // Date proximity
    const entryDate = new Date(entry.date);
    const daysDiff = Math.abs(
      (txnDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff > 7) continue;

    const confidence =
      daysDiff <= 1 ? "high" : daysDiff <= 3 ? "medium" : "low";

    suggestions.push({
      journal_entry_id: entry.id,
      entry_number: entry.entry_number,
      date: entry.date,
      description: entry.description,
      amount: lineAmount,
      confidence,
    });
  }

  // Sort by confidence (high first) then by date proximity
  return suggestions.sort((a, b) => {
    const confOrder = { high: 0, medium: 1, low: 2 };
    const confDiff = confOrder[a.confidence] - confOrder[b.confidence];
    if (confDiff !== 0) return confDiff;
    return (
      Math.abs(new Date(a.date).getTime() - txnDate.getTime()) -
      Math.abs(new Date(b.date).getTime() - txnDate.getTime())
    );
  });
}

/**
 * If a journal entry came from a payment, find and optionally mark the linked invoice as paid.
 */
function findAndMarkLinkedInvoice(
  businessId: string,
  journalEntryId: string
): LinkedInvoiceInfo | null {
  const db = getDb();

  const entry = db
    .select()
    .from(schema.journalEntries)
    .where(
      and(
        eq(schema.journalEntries.id, journalEntryId),
        eq(schema.journalEntries.business_id, businessId),
        eq(schema.journalEntries.source_type, "payment")
      )
    )
    .get();

  if (!entry?.source_id) return null;

  const payment = db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.id, entry.source_id))
    .get();

  if (!payment) return null;

  const invoice = db
    .select()
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.id, payment.invoice_id),
        eq(schema.invoices.business_id, businessId)
      )
    )
    .get();

  if (!invoice) return null;

  let contactName: string | null = null;
  if (invoice.contact_id) {
    const contact = db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.id, invoice.contact_id))
      .get();
    if (contact) {
      contactName = decrypt(contact.name);
    }
  }

  let markedPaid = false;
  if (invoice.status !== "paid" && invoice.amount_due != null && invoice.amount_due <= 0) {
    db.update(schema.invoices)
      .set({ status: "paid", updated_at: new Date() })
      .where(eq(schema.invoices.id, invoice.id))
      .run();
    markedPaid = true;
  }

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number || invoice.id.slice(0, 8),
    contactName,
    amount: invoice.total,
    markedPaid,
  };
}

/**
 * Match a bank transaction to an existing journal entry.
 */
export function matchTransaction(
  businessId: string,
  bankTransactionId: string,
  journalEntryId: string
): { success: boolean; linkedInvoice?: LinkedInvoiceInfo } {
  const db = getDb();

  const txn = db
    .select()
    .from(schema.bankTransactions)
    .where(
      and(
        eq(schema.bankTransactions.id, bankTransactionId),
        eq(schema.bankTransactions.business_id, businessId)
      )
    )
    .get();

  if (!txn) return { success: false };

  db.update(schema.bankTransactions)
    .set({
      matched_journal_entry_id: journalEntryId,
      reconciliation_status: "matched",
    })
    .where(eq(schema.bankTransactions.id, bankTransactionId))
    .run();

  const linkedInvoice = findAndMarkLinkedInvoice(businessId, journalEntryId) ?? undefined;
  return { success: true, linkedInvoice };
}

/**
 * Create a new journal entry from an unmatched bank transaction and match it.
 * Used when a bank transaction has no existing journal (e.g. a direct bank charge).
 */
export function createAndMatch(
  businessId: string,
  bankTransactionId: string,
  accountCode: string,
  description: string,
  gstInclusive: boolean = true,
  gstRate: number = 0.15
): string | null {
  const db = getDb();

  const txn = db
    .select()
    .from(schema.bankTransactions)
    .where(
      and(
        eq(schema.bankTransactions.id, bankTransactionId),
        eq(schema.bankTransactions.business_id, businessId)
      )
    )
    .get();

  if (!txn) return null;

  // Get the linked ledger bank account
  const akahuAccount = db
    .select()
    .from(schema.akahuAccounts)
    .where(eq(schema.akahuAccounts.id, txn.akahu_account_id))
    .get();

  const bankAccountId = akahuAccount?.linked_ledger_account_id;
  if (!bankAccountId) return null;

  const targetAccount = getAccountByCode(businessId, accountCode);
  if (!targetAccount) return null;

  const absAmount = Math.abs(txn.amount);
  let exGst = absAmount;
  let gstAmount = 0;

  if (gstInclusive && targetAccount.gst_applicable) {
    exGst = absAmount / (1 + gstRate);
    gstAmount = absAmount - exGst;
  }

  const lines: JournalLineInput[] = [];

  if (txn.amount < 0) {
    // Money out — expense
    lines.push({ account_id: targetAccount.id, debit: Math.round(exGst * 100) / 100, credit: 0 });
    if (gstAmount > 0) {
      const gstReceivable = getAccountByCode(businessId, SYSTEM_ACCOUNTS.GST_RECEIVABLE);
      if (gstReceivable) {
        lines.push({
          account_id: gstReceivable.id,
          debit: Math.round(gstAmount * 100) / 100,
          credit: 0,
          gst_amount: Math.round(gstAmount * 100) / 100,
          gst_rate: gstRate,
        });
      }
    }
    lines.push({ account_id: bankAccountId, debit: 0, credit: absAmount });
  } else {
    // Money in — revenue
    lines.push({ account_id: bankAccountId, debit: absAmount, credit: 0 });
    if (gstAmount > 0) {
      const gstPayable = getAccountByCode(businessId, SYSTEM_ACCOUNTS.GST_PAYABLE);
      if (gstPayable) {
        lines.push({
          account_id: gstPayable.id,
          debit: 0,
          credit: Math.round(gstAmount * 100) / 100,
          gst_amount: Math.round(gstAmount * 100) / 100,
          gst_rate: gstRate,
        });
      }
    }
    lines.push({ account_id: targetAccount.id, debit: 0, credit: Math.round(exGst * 100) / 100 });
  }

  const entryId = createJournalEntry(businessId, {
    date: txn.date,
    description,
    source_type: "bank_feed",
    source_id: bankTransactionId,
    lines,
  });

  // Match the transaction
  db.update(schema.bankTransactions)
    .set({
      matched_journal_entry_id: entryId,
      reconciliation_status: "matched",
    })
    .where(eq(schema.bankTransactions.id, bankTransactionId))
    .run();

  return entryId;
}

/**
 * Unmatch a bank transaction.
 */
export function unmatchTransaction(
  businessId: string,
  bankTransactionId: string
): boolean {
  const db = getDb();

  db.update(schema.bankTransactions)
    .set({
      matched_journal_entry_id: null,
      reconciliation_status: "unmatched",
    })
    .where(
      and(
        eq(schema.bankTransactions.id, bankTransactionId),
        eq(schema.bankTransactions.business_id, businessId)
      )
    )
    .run();

  return true;
}

/**
 * Mark a matched transaction as reconciled (confirmed correct).
 */
export function reconcileTransaction(
  businessId: string,
  bankTransactionId: string
): { success: boolean; linkedInvoice?: LinkedInvoiceInfo } {
  const db = getDb();

  const txn = db
    .select()
    .from(schema.bankTransactions)
    .where(
      and(
        eq(schema.bankTransactions.id, bankTransactionId),
        eq(schema.bankTransactions.business_id, businessId)
      )
    )
    .get();

  if (!txn || !txn.matched_journal_entry_id) return { success: false };

  db.update(schema.bankTransactions)
    .set({ reconciliation_status: "reconciled" })
    .where(eq(schema.bankTransactions.id, bankTransactionId))
    .run();

  const linkedInvoice = findAndMarkLinkedInvoice(businessId, txn.matched_journal_entry_id) ?? undefined;
  return { success: true, linkedInvoice };
}

/**
 * Exclude a bank transaction from reconciliation (e.g. transfers between own accounts).
 */
export function excludeTransaction(
  businessId: string,
  bankTransactionId: string
): boolean {
  const db = getDb();

  db.update(schema.bankTransactions)
    .set({ reconciliation_status: "excluded" })
    .where(
      and(
        eq(schema.bankTransactions.id, bankTransactionId),
        eq(schema.bankTransactions.business_id, businessId)
      )
    )
    .run();

  return true;
}

/**
 * Get reconciliation status summary for a business.
 */
export function getReconciliationStatus(
  businessId: string
): ReconciliationStatus {
  const db = getDb();

  const txns = db
    .select()
    .from(schema.bankTransactions)
    .where(eq(schema.bankTransactions.business_id, businessId))
    .all();

  const matched = txns.filter((t) => t.reconciliation_status === "matched").length;
  const reconciled = txns.filter((t) => t.reconciliation_status === "reconciled").length;
  const unmatched = txns.filter((t) => t.reconciliation_status === "unmatched").length;
  const excluded = txns.filter((t) => t.reconciliation_status === "excluded").length;

  // Get bank balance from Akahu account
  const akahuAccounts = db
    .select()
    .from(schema.akahuAccounts)
    .where(eq(schema.akahuAccounts.linked_business_id, businessId))
    .all();
  const bankBalance = akahuAccounts.length > 0
    ? akahuAccounts.reduce((sum, a) => sum + a.balance, 0)
    : null;

  // Get ledger bank balance
  const bankAccount = getAccountByCode(businessId, SYSTEM_ACCOUNTS.CASH_AT_BANK);
  let ledgerBalance = 0;
  if (bankAccount) {
    const lines = db
      .select()
      .from(schema.journalLines)
      .where(eq(schema.journalLines.account_id, bankAccount.id))
      .all();
    ledgerBalance = Math.round(
      lines.reduce((sum, l) => sum + l.debit - l.credit, 0) * 100
    ) / 100;
  }

  return {
    totalTransactions: txns.length,
    matched,
    reconciled,
    unmatched,
    excluded,
    bankBalance,
    ledgerBalance,
  };
}

// ── Reconciliation Rules ──

/**
 * Apply saved reconciliation rules to unmatched bank transactions.
 * For each unmatched transaction, check if its description matches a rule.
 * If so, create a journal entry and match it.
 */
export function applyReconciliationRules(businessId: string): number {
  const db = getDb();

  const rules = db
    .select()
    .from(schema.reconciliationRules)
    .where(eq(schema.reconciliationRules.business_id, businessId))
    .all();

  if (rules.length === 0) return 0;

  const unmatched = db
    .select()
    .from(schema.bankTransactions)
    .where(
      and(
        eq(schema.bankTransactions.business_id, businessId),
        eq(schema.bankTransactions.reconciliation_status, "unmatched")
      )
    )
    .all();

  let matched = 0;

  for (const txn of unmatched) {
    const desc = decrypt(txn.description).toLowerCase();

    for (const rule of rules) {
      if (desc.includes(rule.match_pattern.toLowerCase())) {
        const account = db
          .select()
          .from(schema.accounts)
          .where(eq(schema.accounts.id, rule.account_id))
          .get();

        if (!account) continue;

        try {
          createAndMatch(
            businessId,
            txn.id,
            account.code,
            rule.description_template,
            rule.gst_inclusive
          );
          matched++;
        } catch (e) {
          console.error(`[reconciliation] Rule failed for txn ${txn.id}:`, e);
        }
        break; // Only apply first matching rule
      }
    }
  }

  return matched;
}

/**
 * Create a reconciliation rule.
 */
export function createReconciliationRule(
  businessId: string,
  data: {
    match_pattern: string;
    account_id: string;
    description_template: string;
    gst_inclusive?: boolean;
  }
): string {
  const db = getDb();
  const id = uuid();

  db.insert(schema.reconciliationRules)
    .values({
      id,
      business_id: businessId,
      match_pattern: data.match_pattern,
      account_id: data.account_id,
      description_template: data.description_template,
      gst_inclusive: data.gst_inclusive ?? true,
    })
    .run();

  return id;
}

/**
 * List reconciliation rules for a business.
 */
export function listReconciliationRules(businessId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.reconciliationRules)
    .where(eq(schema.reconciliationRules.business_id, businessId))
    .all();
}

/**
 * Delete a reconciliation rule.
 */
export function deleteReconciliationRule(
  businessId: string,
  ruleId: string
): boolean {
  const db = getDb();
  const result = db
    .delete(schema.reconciliationRules)
    .where(
      and(
        eq(schema.reconciliationRules.id, ruleId),
        eq(schema.reconciliationRules.business_id, businessId)
      )
    )
    .run();
  return result.changes > 0;
}
