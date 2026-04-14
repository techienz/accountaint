import { v4 as uuid } from "uuid";
import { eq, and, sql, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { JournalEntryInput, JournalSourceType } from "./types";

/**
 * Create a balanced journal entry with lines.
 * Throws if debits don't equal credits.
 */
export function createJournalEntry(
  businessId: string,
  input: JournalEntryInput
): string {
  const db = getDb();

  // Validate balance
  const totalDebit = input.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = input.lines.reduce((sum, l) => sum + l.credit, 0);
  const diff = Math.abs(totalDebit - totalCredit);

  if (diff > 0.01) {
    throw new Error(
      `Journal entry is unbalanced: debits=${totalDebit.toFixed(2)}, credits=${totalCredit.toFixed(2)}`
    );
  }

  if (input.lines.length < 2) {
    throw new Error("Journal entry must have at least 2 lines");
  }

  // Validate each line has either debit or credit (not both > 0)
  for (const line of input.lines) {
    if (line.debit > 0 && line.credit > 0) {
      throw new Error("A journal line cannot have both debit and credit > 0");
    }
    if (line.debit < 0 || line.credit < 0) {
      throw new Error("Debit and credit amounts must be non-negative");
    }
  }

  // Get next entry number for this business
  const lastEntry = db
    .select({ entry_number: schema.journalEntries.entry_number })
    .from(schema.journalEntries)
    .where(eq(schema.journalEntries.business_id, businessId))
    .orderBy(desc(schema.journalEntries.entry_number))
    .limit(1)
    .get();
  const entryNumber = (lastEntry?.entry_number ?? 0) + 1;

  const entryId = uuid();

  db.insert(schema.journalEntries)
    .values({
      id: entryId,
      business_id: businessId,
      entry_number: entryNumber,
      date: input.date,
      description: input.description,
      source_type: input.source_type,
      source_id: input.source_id ?? null,
      is_posted: true,
      is_reversed: false,
    })
    .run();

  for (let i = 0; i < input.lines.length; i++) {
    const line = input.lines[i];
    db.insert(schema.journalLines)
      .values({
        id: uuid(),
        journal_entry_id: entryId,
        account_id: line.account_id,
        debit: Math.round(line.debit * 100) / 100,
        credit: Math.round(line.credit * 100) / 100,
        description: line.description ?? null,
        gst_amount: line.gst_amount ?? null,
        gst_rate: line.gst_rate ?? null,
        contact_id: line.contact_id ?? null,
        sort_order: i,
      })
      .run();
  }

  return entryId;
}

/**
 * Reverse a journal entry by creating a new entry with swapped debits/credits.
 */
export function reverseJournalEntry(
  businessId: string,
  entryId: string,
  date: string
): string {
  const db = getDb();

  const entry = db
    .select()
    .from(schema.journalEntries)
    .where(
      and(
        eq(schema.journalEntries.id, entryId),
        eq(schema.journalEntries.business_id, businessId)
      )
    )
    .get();

  if (!entry) throw new Error("Journal entry not found");
  if (entry.is_reversed) throw new Error("Journal entry already reversed");

  const lines = db
    .select()
    .from(schema.journalLines)
    .where(eq(schema.journalLines.journal_entry_id, entryId))
    .all();

  // Create reversal entry with swapped debits/credits
  const reversalId = createJournalEntry(businessId, {
    date,
    description: `Reversal of JE#${entry.entry_number}: ${entry.description}`,
    source_type: entry.source_type as JournalSourceType,
    source_id: entry.source_id ?? undefined,
    lines: lines.map((l) => ({
      account_id: l.account_id,
      debit: l.credit,
      credit: l.debit,
      description: l.description ?? undefined,
      gst_amount: l.gst_amount ? -l.gst_amount : undefined,
      gst_rate: l.gst_rate ?? undefined,
      contact_id: l.contact_id ?? undefined,
    })),
  });

  // Mark original as reversed
  db.update(schema.journalEntries)
    .set({ is_reversed: true, updated_at: new Date() })
    .where(eq(schema.journalEntries.id, entryId))
    .run();

  // Set reversal_of_id on the new entry
  db.update(schema.journalEntries)
    .set({ reversal_of_id: entryId })
    .where(eq(schema.journalEntries.id, reversalId))
    .run();

  return reversalId;
}

/**
 * Check if a journal entry already exists for a given source.
 * Used to prevent duplicate posting.
 */
export function hasJournalForSource(
  businessId: string,
  sourceType: JournalSourceType,
  sourceId: string
): boolean {
  const db = getDb();
  const entry = db
    .select({ id: schema.journalEntries.id })
    .from(schema.journalEntries)
    .where(
      and(
        eq(schema.journalEntries.business_id, businessId),
        eq(schema.journalEntries.source_type, sourceType),
        eq(schema.journalEntries.source_id, sourceId),
        eq(schema.journalEntries.is_reversed, false)
      )
    )
    .limit(1)
    .get();
  return !!entry;
}

/**
 * Get all journal entries for a business within a date range.
 */
export function listJournalEntries(
  businessId: string,
  options?: { from?: string; to?: string; sourceType?: JournalSourceType }
) {
  const db = getDb();
  const conditions = [eq(schema.journalEntries.business_id, businessId)];

  if (options?.sourceType) {
    conditions.push(eq(schema.journalEntries.source_type, options.sourceType));
  }

  let query = db
    .select()
    .from(schema.journalEntries)
    .where(and(...conditions))
    .orderBy(desc(schema.journalEntries.date), desc(schema.journalEntries.entry_number));

  const entries = query.all();

  // Filter by date range in JS (SQLite text comparison works for YYYY-MM-DD)
  return entries.filter((e) => {
    if (options?.from && e.date < options.from) return false;
    if (options?.to && e.date > options.to) return false;
    return true;
  });
}

/**
 * Get journal lines for an entry.
 */
export function getJournalLines(entryId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.journalLines)
    .where(eq(schema.journalLines.journal_entry_id, entryId))
    .orderBy(schema.journalLines.sort_order)
    .all();
}

/**
 * Get a trial balance: sum of debits and credits per account.
 */
export function getTrialBalance(
  businessId: string,
  options?: { from?: string; to?: string }
) {
  const db = getDb();

  // Get all posted, non-reversed entries for this business
  const entries = db
    .select({ id: schema.journalEntries.id, date: schema.journalEntries.date })
    .from(schema.journalEntries)
    .where(
      and(
        eq(schema.journalEntries.business_id, businessId),
        eq(schema.journalEntries.is_posted, true)
      )
    )
    .all();

  // Filter by date
  const entryIds = entries
    .filter((e) => {
      if (options?.from && e.date < options.from) return false;
      if (options?.to && e.date > options.to) return false;
      return true;
    })
    .map((e) => e.id);

  if (entryIds.length === 0) return [];

  // Get all lines for these entries
  const allLines = db
    .select()
    .from(schema.journalLines)
    .all();

  const filteredLines = allLines.filter((l) =>
    entryIds.includes(l.journal_entry_id)
  );

  // Aggregate by account
  const accountTotals = new Map<
    string,
    { debit: number; credit: number }
  >();

  for (const line of filteredLines) {
    const existing = accountTotals.get(line.account_id) ?? {
      debit: 0,
      credit: 0,
    };
    existing.debit += line.debit;
    existing.credit += line.credit;
    accountTotals.set(line.account_id, existing);
  }

  // Get account details
  const allAccounts = db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.business_id, businessId))
    .orderBy(schema.accounts.code)
    .all();

  return allAccounts
    .filter((a) => accountTotals.has(a.id))
    .map((a) => {
      const totals = accountTotals.get(a.id)!;
      return {
        account_id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        sub_type: a.sub_type,
        debit: Math.round(totals.debit * 100) / 100,
        credit: Math.round(totals.credit * 100) / 100,
        balance: Math.round((totals.debit - totals.credit) * 100) / 100,
      };
    });
}
