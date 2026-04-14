import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export type GeneralLedgerEntry = {
  date: string;
  entry_number: number;
  description: string;
  source_type: string;
  debit: number;
  credit: number;
  running_balance: number;
};

export type GeneralLedgerReport = {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  entries: GeneralLedgerEntry[];
  opening_balance: number;
  closing_balance: number;
  total_debit: number;
  total_credit: number;
};

/**
 * Generate a general ledger report for a specific account.
 * Shows all journal lines with running balance.
 */
export function generateGeneralLedger(
  businessId: string,
  accountId: string,
  options?: { from?: string; to?: string }
): GeneralLedgerReport | null {
  const db = getDb();

  const account = db
    .select()
    .from(schema.accounts)
    .where(
      and(
        eq(schema.accounts.id, accountId),
        eq(schema.accounts.business_id, businessId)
      )
    )
    .get();

  if (!account) return null;

  // Get all posted journal entries for this business
  const journalEntriesAll = db
    .select()
    .from(schema.journalEntries)
    .where(
      and(
        eq(schema.journalEntries.business_id, businessId),
        eq(schema.journalEntries.is_posted, true)
      )
    )
    .all();

  // Get all lines for this account
  const allLines = db
    .select()
    .from(schema.journalLines)
    .where(eq(schema.journalLines.account_id, accountId))
    .all();

  // Join lines with entries and filter by date
  const entriesMap = new Map(journalEntriesAll.map((e) => [e.id, e]));

  const joined = allLines
    .map((line) => {
      const entry = entriesMap.get(line.journal_entry_id);
      if (!entry) return null;
      return { ...line, entry };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .filter((x) => {
      if (options?.from && x.entry.date < options.from) return false;
      if (options?.to && x.entry.date > options.to) return false;
      return true;
    })
    .sort((a, b) => {
      const dateCompare = a.entry.date.localeCompare(b.entry.date);
      if (dateCompare !== 0) return dateCompare;
      return a.entry.entry_number - b.entry.entry_number;
    });

  // Build entries with running balance
  let runningBalance = 0;
  let totalDebit = 0;
  let totalCredit = 0;

  const entries: GeneralLedgerEntry[] = joined.map((j) => {
    runningBalance += j.debit - j.credit;
    totalDebit += j.debit;
    totalCredit += j.credit;

    return {
      date: j.entry.date,
      entry_number: j.entry.entry_number,
      description: j.entry.description,
      source_type: j.entry.source_type,
      debit: j.debit,
      credit: j.credit,
      running_balance: Math.round(runningBalance * 100) / 100,
    };
  });

  return {
    account_id: accountId,
    account_code: account.code,
    account_name: account.name,
    account_type: account.type,
    entries,
    opening_balance: 0,
    closing_balance: Math.round(runningBalance * 100) / 100,
    total_debit: Math.round(totalDebit * 100) / 100,
    total_credit: Math.round(totalCredit * 100) / 100,
  };
}
