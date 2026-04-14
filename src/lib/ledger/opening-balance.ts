import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getAccountByCode } from "./accounts";
import { createJournalEntry, reverseJournalEntry } from "./journals";
import type { JournalLineInput } from "./types";

type OpeningBalanceInput = {
  effectiveDate: string;
  bankBalance: number;
  receivables: Array<{ name: string; amount: number }>;
  payables: Array<{ name: string; amount: number }>;
};

type OpeningBalanceResult = {
  journalEntryId: string | null;
  error?: string;
};

/**
 * Check if an opening balance journal entry already exists for this business.
 */
export function getExistingOpeningBalance(businessId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.journalEntries)
    .where(
      and(
        eq(schema.journalEntries.business_id, businessId),
        eq(schema.journalEntries.source_type, "opening_balance"),
        eq(schema.journalEntries.is_reversed, false)
      )
    )
    .limit(1)
    .get();
}

/**
 * Create a standalone opening balance journal entry.
 * If one already exists, reverses it first.
 */
export function createOpeningBalance(
  businessId: string,
  input: OpeningBalanceInput
): OpeningBalanceResult {
  const bankAccount = getAccountByCode(businessId, "1100");
  const arAccount = getAccountByCode(businessId, "1200");
  const apAccount = getAccountByCode(businessId, "2100");
  const retainedEarnings = getAccountByCode(businessId, "3200");

  if (!bankAccount || !arAccount || !apAccount || !retainedEarnings) {
    return {
      journalEntryId: null,
      error: "Chart of Accounts not set up. Please seed the COA first.",
    };
  }

  // Reverse existing opening balance if any
  const existing = getExistingOpeningBalance(businessId);
  if (existing) {
    try {
      reverseJournalEntry(businessId, existing.id, new Date().toISOString().slice(0, 10));
    } catch (e) {
      console.error("[opening-balance] Failed to reverse existing:", e);
    }
  }

  const lines: JournalLineInput[] = [];

  // Bank balance (debit if positive — asset)
  if (input.bankBalance !== 0) {
    if (input.bankBalance > 0) {
      lines.push({
        account_id: bankAccount.id,
        debit: input.bankBalance,
        credit: 0,
        description: "Opening balance: Bank",
      });
    } else {
      lines.push({
        account_id: bankAccount.id,
        debit: 0,
        credit: Math.abs(input.bankBalance),
        description: "Opening balance: Bank (overdraft)",
      });
    }
  }

  // Receivables (debit — asset)
  for (const r of input.receivables) {
    if (r.amount > 0) {
      lines.push({
        account_id: arAccount.id,
        debit: r.amount,
        credit: 0,
        description: `Opening balance: ${r.name}`,
      });
    }
  }

  // Payables (credit — liability)
  for (const p of input.payables) {
    if (p.amount > 0) {
      lines.push({
        account_id: apAccount.id,
        debit: 0,
        credit: p.amount,
        description: `Opening balance: ${p.name}`,
      });
    }
  }

  if (lines.length === 0) {
    return {
      journalEntryId: null,
      error: "No balances entered. Nothing to create.",
    };
  }

  // Calculate balancing entry for retained earnings
  const totalDebits = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredits = lines.reduce((s, l) => s + l.credit, 0);
  const diff = Math.round((totalDebits - totalCredits) * 100) / 100;

  if (diff > 0) {
    lines.push({
      account_id: retainedEarnings.id,
      debit: 0,
      credit: diff,
      description: "Opening balance: Retained Earnings",
    });
  } else if (diff < 0) {
    lines.push({
      account_id: retainedEarnings.id,
      debit: Math.abs(diff),
      credit: 0,
      description: "Opening balance: Retained Earnings",
    });
  }

  try {
    const journalEntryId = createJournalEntry(businessId, {
      date: input.effectiveDate,
      description: "Opening Balances",
      source_type: "opening_balance",
      lines,
    });
    return { journalEntryId };
  } catch (err) {
    return {
      journalEntryId: null,
      error: `Failed to create journal entry: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
