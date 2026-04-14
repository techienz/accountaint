import { createHash } from "crypto";
import { v4 as uuid } from "uuid";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";
import {
  fetchAccounts,
  fetchTransactions,
  type AkahuAccount,
  type AkahuTransaction,
} from "./client";
import { buildCategoryMap, matchCategory } from "@/lib/budget/transactions";

// ── Account sync ───────────────────────────────────────────────────

/**
 * Fetch accounts from Akahu and upsert into akahu_accounts.
 * Updates balances and names for existing accounts, inserts new ones.
 */
export async function syncAccounts(userId: string): Promise<{
  synced: number;
  new: number;
}> {
  const db = getDb();
  const connection = db
    .select()
    .from(schema.akahuConnections)
    .where(eq(schema.akahuConnections.user_id, userId))
    .get();

  if (!connection) {
    throw new Error("No Akahu connection found for this user");
  }

  const storedToken = decrypt(connection.access_token);
  // Personal apps store "personal_app" as placeholder — use null to trigger config lookup
  const accessToken = storedToken === "personal_app" ? null : storedToken;
  const accounts = await fetchAccounts(accessToken);

  let newCount = 0;

  for (const account of accounts) {
    if (account.status !== "ACTIVE") continue;

    const existing = db
      .select()
      .from(schema.akahuAccounts)
      .where(eq(schema.akahuAccounts.id, account._id))
      .get();

    if (existing) {
      // Update balance and name
      db.update(schema.akahuAccounts)
        .set({
          name: encrypt(account.name),
          institution: encrypt(account.connection.name),
          balance: account.balance?.current ?? 0,
          available_balance: account.balance?.available ?? null,
          last_synced_at: new Date(),
        })
        .where(eq(schema.akahuAccounts.id, account._id))
        .run();
    } else {
      db.insert(schema.akahuAccounts)
        .values({
          id: account._id,
          akahu_connection_id: connection.id,
          user_id: userId,
          name: encrypt(account.name),
          institution: encrypt(account.connection.name),
          account_type: mapAccountType(account),
          balance: account.balance?.current ?? 0,
          available_balance: account.balance?.available ?? null,
          last_synced_at: new Date(),
        })
        .run();
      newCount++;
    }
  }

  return { synced: accounts.length, new: newCount };
}

// ── Transaction sync ───────────────────────────────────────────────

/**
 * Sync transactions for all linked Akahu accounts belonging to a user.
 * Routes transactions to budget_transactions (personal) or bank_transactions (business).
 */
export async function syncTransactions(userId: string): Promise<{
  personal: number;
  business: number;
  duplicates: number;
}> {
  const db = getDb();
  const connection = db
    .select()
    .from(schema.akahuConnections)
    .where(eq(schema.akahuConnections.user_id, userId))
    .get();

  if (!connection) {
    throw new Error("No Akahu connection found for this user");
  }

  const storedTxToken = decrypt(connection.access_token);
  const accessToken = storedTxToken === "personal_app" ? null : storedTxToken;
  const accounts = db
    .select()
    .from(schema.akahuAccounts)
    .where(eq(schema.akahuAccounts.user_id, userId))
    .all();

  let personalCount = 0;
  let businessCount = 0;
  let duplicateCount = 0;

  for (const account of accounts) {
    // Skip unlinked accounts
    if (!account.linked_budget_account_id && !account.linked_business_id) {
      continue;
    }

    // Fetch last 90 days of transactions by default
    const start = new Date();
    start.setDate(start.getDate() - 90);
    const startStr = start.toISOString().slice(0, 10);

    const transactions = await fetchTransactions(accessToken, account.id, {
      start: startStr,
    });

    if (account.linked_budget_account_id) {
      // Personal: import into budget_transactions
      const result = importPersonalTransactions(
        userId,
        account.linked_budget_account_id,
        transactions
      );
      personalCount += result.imported;
      duplicateCount += result.duplicates;
    } else if (account.linked_business_id) {
      // Business: import into bank_transactions
      const result = importBusinessTransactions(
        account.linked_business_id,
        account.id,
        transactions
      );
      businessCount += result.imported;
      duplicateCount += result.duplicates;
    }

    // Update last synced time
    db.update(schema.akahuAccounts)
      .set({ last_synced_at: new Date() })
      .where(eq(schema.akahuAccounts.id, account.id))
      .run();
  }

  return { personal: personalCount, business: businessCount, duplicates: duplicateCount };
}

// ── Personal transaction import ────────────────────────────────────

function importPersonalTransactions(
  userId: string,
  bankAccountId: string,
  transactions: AkahuTransaction[]
): { imported: number; duplicates: number } {
  const db = getDb();

  // Get existing dedup hashes
  const existingHashes = new Set(
    db
      .select({ hash: schema.budgetTransactions.dedup_hash })
      .from(schema.budgetTransactions)
      .where(eq(schema.budgetTransactions.user_id, userId))
      .all()
      .map((r) => r.hash)
  );

  // Build category map for auto-categorisation
  const categoryMap = buildCategoryMap(userId);
  const batchId = uuid();

  let imported = 0;
  let duplicates = 0;

  for (const tx of transactions) {
    // Dedup hash based on akahu transaction ID for stability
    const dedupHash = createHash("sha256")
      .update(tx._id)
      .digest("hex");

    if (existingHashes.has(dedupHash)) {
      duplicates++;
      continue;
    }

    const description = tx.description;
    const amount = tx.amount;
    const type = amount < 0 ? "debit" : "credit";
    const matched = matchCategory(description, categoryMap);

    db.insert(schema.budgetTransactions)
      .values({
        id: uuid(),
        user_id: userId,
        bank_account_id: bankAccountId,
        category_id: matched?.categoryId ?? null,
        date: tx.date.slice(0, 10),
        description: encrypt(description),
        amount,
        balance: tx.balance ?? null,
        type,
        dedup_hash: dedupHash,
        is_categorised: matched !== null,
        notes: null,
        import_batch: batchId,
      })
      .run();

    imported++;
    existingHashes.add(dedupHash);
  }

  return { imported, duplicates };
}

// ── Business transaction import ────────────────────────────────────

function importBusinessTransactions(
  businessId: string,
  akahuAccountId: string,
  transactions: AkahuTransaction[]
): { imported: number; duplicates: number } {
  const db = getDb();

  // Get existing akahu transaction IDs for dedup
  const existingIds = new Set(
    db
      .select({ txId: schema.bankTransactions.akahu_transaction_id })
      .from(schema.bankTransactions)
      .where(eq(schema.bankTransactions.business_id, businessId))
      .all()
      .map((r) => r.txId)
  );

  let imported = 0;
  let duplicates = 0;

  for (const tx of transactions) {
    if (existingIds.has(tx._id)) {
      duplicates++;
      continue;
    }

    db.insert(schema.bankTransactions)
      .values({
        id: uuid(),
        business_id: businessId,
        akahu_account_id: akahuAccountId,
        akahu_transaction_id: tx._id,
        date: tx.date.slice(0, 10),
        description: encrypt(tx.description),
        amount: tx.amount,
        balance: tx.balance ?? null,
        merchant_name: tx.merchant?.name ? encrypt(tx.merchant.name) : null,
        reconciliation_status: "unmatched",
        matched_journal_entry_id: null,
      })
      .run();

    imported++;
    existingIds.add(tx._id);
  }

  return { imported, duplicates };
}

// ── Sync all users (for scheduler) ────────────────────────────────

/**
 * Sync accounts and transactions for all users with Akahu connections.
 */
export async function syncAllAkahu(): Promise<void> {
  const db = getDb();
  const connections = db.select().from(schema.akahuConnections).all();

  for (const conn of connections) {
    try {
      await syncAccounts(conn.user_id);
      await syncTransactions(conn.user_id);
      console.log(`[akahu] Sync complete for user ${conn.user_id}`);
    } catch (error) {
      console.error(`[akahu] Sync failed for user ${conn.user_id}:`, error);
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function mapAccountType(account: AkahuAccount): string {
  const type = account.type?.toLowerCase() ?? "";
  if (type.includes("credit")) return "credit_card";
  if (type.includes("saving")) return "savings";
  if (type.includes("loan") || type.includes("mortgage")) return "loan";
  return "checking";
}
