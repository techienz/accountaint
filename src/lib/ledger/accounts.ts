import { v4 as uuid } from "uuid";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { DEFAULT_NZ_COA } from "./seed-coa";
import type { AccountSeed } from "./types";

/**
 * Seed the default NZ Chart of Accounts for a business.
 * Skips if accounts already exist for this business.
 */
export function seedChartOfAccounts(businessId: string): number {
  const db = getDb();

  const existing = db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(eq(schema.accounts.business_id, businessId))
    .limit(1)
    .all();

  if (existing.length > 0) return 0;

  let count = 0;

  function insertAccount(seed: AccountSeed, parentId: string | null) {
    const id = uuid();
    db.insert(schema.accounts)
      .values({
        id,
        business_id: businessId,
        code: seed.code,
        name: seed.name,
        type: seed.type,
        sub_type: seed.sub_type,
        is_system: seed.is_system ?? false,
        gst_applicable: seed.gst_applicable ?? true,
        parent_account_id: parentId,
        sort_order: count,
      })
      .run();
    count++;

    if (seed.children) {
      for (const child of seed.children) {
        insertAccount(child, id);
      }
    }
  }

  for (const account of DEFAULT_NZ_COA) {
    insertAccount(account, null);
  }

  return count;
}

/**
 * Get all accounts for a business, sorted by code.
 */
export function listAccounts(businessId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.accounts)
    .where(
      and(
        eq(schema.accounts.business_id, businessId),
        eq(schema.accounts.is_active, true)
      )
    )
    .orderBy(schema.accounts.code)
    .all();
}

/**
 * Find an account by code for a business.
 */
export function getAccountByCode(businessId: string, code: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.accounts)
    .where(
      and(
        eq(schema.accounts.business_id, businessId),
        eq(schema.accounts.code, code)
      )
    )
    .get();
}

/**
 * Check if a business has a Chart of Accounts seeded.
 */
export function hasChartOfAccounts(businessId: string): boolean {
  const db = getDb();
  const row = db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(eq(schema.accounts.business_id, businessId))
    .limit(1)
    .get();
  return !!row;
}
