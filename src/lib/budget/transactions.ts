import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/encryption";
import { parseBankCSV, type ParsedTransaction, type ParseResult } from "./bank-csv";
import { listRecurringItems, listCategories } from "./index";

// ── Types ───────────────────────────────────────────────────────────

type TransactionRow = typeof schema.budgetTransactions.$inferSelect;

export type Transaction = Omit<TransactionRow, "description" | "notes"> & {
  description: string;
  notes: string | null;
};

// ── CRUD ────────────────────────────────────────────────────────────

export function listTransactions(
  userId: string,
  filters?: {
    bankAccountId?: string;
    categoryId?: string | null;
    startDate?: string;
    endDate?: string;
    uncategorisedOnly?: boolean;
  }
) {
  const db = getDb();
  const conditions = [eq(schema.budgetTransactions.user_id, userId)];

  if (filters?.bankAccountId)
    conditions.push(
      eq(schema.budgetTransactions.bank_account_id, filters.bankAccountId)
    );
  if (filters?.categoryId !== undefined) {
    if (filters.categoryId === null) {
      // Category IS NULL is handled differently — filter in JS below
    } else {
      conditions.push(
        eq(schema.budgetTransactions.category_id, filters.categoryId)
      );
    }
  }
  if (filters?.startDate)
    conditions.push(gte(schema.budgetTransactions.date, filters.startDate));
  if (filters?.endDate)
    conditions.push(lte(schema.budgetTransactions.date, filters.endDate));
  if (filters?.uncategorisedOnly)
    conditions.push(eq(schema.budgetTransactions.is_categorised, false));

  let rows = db
    .select()
    .from(schema.budgetTransactions)
    .where(and(...conditions))
    .orderBy(desc(schema.budgetTransactions.date))
    .all();

  if (filters?.categoryId === null) {
    rows = rows.filter((r) => r.category_id === null);
  }

  return rows.map(decryptRow);
}

export function getTransaction(id: string, userId: string) {
  const db = getDb();
  const row = db
    .select()
    .from(schema.budgetTransactions)
    .where(
      and(
        eq(schema.budgetTransactions.id, id),
        eq(schema.budgetTransactions.user_id, userId)
      )
    )
    .get();
  if (!row) return null;
  return decryptRow(row);
}

export function updateTransaction(
  id: string,
  userId: string,
  data: { category_id?: string | null; bank_account_id?: string | null }
) {
  const db = getDb();
  const updates: Record<string, unknown> = {};
  if (data.category_id !== undefined) {
    updates.category_id = data.category_id;
    updates.is_categorised = data.category_id !== null;
  }
  if (data.bank_account_id !== undefined) {
    updates.bank_account_id = data.bank_account_id;
  }
  if (Object.keys(updates).length === 0) return getTransaction(id, userId);

  db.update(schema.budgetTransactions)
    .set(updates)
    .where(
      and(
        eq(schema.budgetTransactions.id, id),
        eq(schema.budgetTransactions.user_id, userId)
      )
    )
    .run();
  return getTransaction(id, userId);
}

export function bulkUpdateCategory(
  ids: string[],
  userId: string,
  categoryId: string | null
) {
  const db = getDb();
  for (const id of ids) {
    db.update(schema.budgetTransactions)
      .set({
        category_id: categoryId,
        is_categorised: categoryId !== null,
      })
      .where(
        and(
          eq(schema.budgetTransactions.id, id),
          eq(schema.budgetTransactions.user_id, userId)
        )
      )
      .run();
  }
}

export function deleteTransaction(id: string, userId: string) {
  const db = getDb();
  const result = db
    .delete(schema.budgetTransactions)
    .where(
      and(
        eq(schema.budgetTransactions.id, id),
        eq(schema.budgetTransactions.user_id, userId)
      )
    )
    .run();
  return result.changes > 0;
}

// ── Import ──────────────────────────────────────────────────────────

export type ImportResult = {
  parseResult: ParseResult;
  imported: number;
  duplicates: number;
  categorised: number;
  batchId: string;
};

export function importTransactions(
  userId: string,
  csvText: string,
  bankAccountId?: string | null
): ImportResult {
  const db = getDb();
  const parseResult = parseBankCSV(csvText);
  const batchId = uuid();

  // Get existing hashes for dedup
  const existingHashes = new Set(
    db
      .select({ hash: schema.budgetTransactions.dedup_hash })
      .from(schema.budgetTransactions)
      .where(eq(schema.budgetTransactions.user_id, userId))
      .all()
      .map((r) => r.hash)
  );

  // Auto-categorise
  const categoryMap = buildCategoryMap(userId);

  let imported = 0;
  let duplicates = 0;
  let categorised = 0;

  for (const tx of parseResult.transactions) {
    if (existingHashes.has(tx.dedup_hash)) {
      duplicates++;
      continue;
    }

    const matched = matchCategory(tx.description, categoryMap);

    db.insert(schema.budgetTransactions)
      .values({
        id: uuid(),
        user_id: userId,
        bank_account_id: bankAccountId ?? null,
        category_id: matched?.categoryId ?? null,
        date: tx.date,
        description: encrypt(tx.description),
        amount: tx.amount,
        balance: tx.balance,
        type: tx.type,
        dedup_hash: tx.dedup_hash,
        is_categorised: matched !== null,
        notes: null,
        import_batch: batchId,
      })
      .run();

    imported++;
    if (matched) categorised++;
    existingHashes.add(tx.dedup_hash);
  }

  return { parseResult, imported, duplicates, categorised, batchId };
}

export function previewImport(csvText: string): ParseResult & { total: number } {
  const result = parseBankCSV(csvText);
  return { ...result, total: result.transactions.length };
}

// ── Category matching ───────────────────────────────────────────────

export type CategoryMapEntry = {
  categoryId: string;
  keywords: string[];
};

export function buildCategoryMap(userId: string): CategoryMapEntry[] {
  const recurring = listRecurringItems(userId);
  const categories = listCategories(userId);

  const catMap: Record<string, string[]> = {};
  for (const item of recurring) {
    if (!item.category_id) continue;
    if (!catMap[item.category_id]) catMap[item.category_id] = [];
    // Use the recurring item name as a keyword
    catMap[item.category_id].push(item.name.toLowerCase());
  }

  return Object.entries(catMap).map(([categoryId, keywords]) => ({
    categoryId,
    keywords,
  }));
}

export function matchCategory(
  description: string,
  categoryMap: CategoryMapEntry[]
): { categoryId: string } | null {
  const lower = description.toLowerCase();

  for (const entry of categoryMap) {
    for (const keyword of entry.keywords) {
      // Check if any word from the keyword appears in the description
      const words = keyword.split(/\s+/).filter((w) => w.length > 3);
      if (words.length === 0) continue;

      const matchCount = words.filter((w) => lower.includes(w)).length;
      if (matchCount >= Math.max(1, Math.ceil(words.length * 0.5))) {
        return { categoryId: entry.categoryId };
      }
    }
  }

  return null;
}

// ── Monthly summary ─────────────────────────────────────────────────

export type MonthlySummary = {
  month: string; // YYYY-MM
  totalSpending: number;
  totalIncome: number;
  byCategory: {
    categoryId: string | null;
    categoryName: string;
    categoryColor: string | null;
    total: number;
    count: number;
  }[];
};

export function getTransactionSummary(
  userId: string,
  startDate?: string,
  endDate?: string
): MonthlySummary[] {
  const transactions = listTransactions(userId, { startDate, endDate });
  const categories = listCategories(userId);
  const catLookup = new Map(categories.map((c) => [c.id, c]));

  // Group by month
  const monthMap = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const month = tx.date.slice(0, 7);
    if (!monthMap.has(month)) monthMap.set(month, []);
    monthMap.get(month)!.push(tx);
  }

  const summaries: MonthlySummary[] = [];
  for (const [month, txs] of monthMap) {
    const debits = txs.filter((t) => t.type === "debit");
    const credits = txs.filter((t) => t.type === "credit");

    // Group debits by category
    const catTotals = new Map<
      string | null,
      { total: number; count: number }
    >();
    for (const tx of debits) {
      const key = tx.category_id;
      const existing = catTotals.get(key) ?? { total: 0, count: 0 };
      existing.total += Math.abs(tx.amount);
      existing.count++;
      catTotals.set(key, existing);
    }

    const byCategory = Array.from(catTotals.entries())
      .map(([catId, data]) => {
        const cat = catId ? catLookup.get(catId) : null;
        return {
          categoryId: catId,
          categoryName: cat?.name ?? "Uncategorised",
          categoryColor: cat?.color ?? null,
          total: Math.round(data.total * 100) / 100,
          count: data.count,
        };
      })
      .sort((a, b) => b.total - a.total);

    summaries.push({
      month,
      totalSpending: Math.round(
        debits.reduce((s, t) => s + Math.abs(t.amount), 0) * 100
      ) / 100,
      totalIncome: Math.round(
        credits.reduce((s, t) => s + t.amount, 0) * 100
      ) / 100,
      byCategory,
    });
  }

  return summaries.sort((a, b) => b.month.localeCompare(a.month));
}

// ── Helpers ─────────────────────────────────────────────────────────

function decryptRow(row: TransactionRow): Transaction {
  return {
    ...row,
    description: decrypt(row.description),
    notes: row.notes ? decrypt(row.notes) : null,
  };
}
