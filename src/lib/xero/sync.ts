import { v4 as uuid } from "uuid";
import { createHash } from "crypto";
import { eq, and, desc, lt } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getAuthedClient } from "./client";
import type { XeroEntityType, SyncResult } from "./types";

const XERO_API_BASE = "https://api.xero.com";

/**
 * Make an authenticated GET request to the Xero API.
 */
async function xeroGet(
  accessToken: string,
  tenantId: string,
  path: string
): Promise<unknown> {
  const response = await fetch(`${XERO_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "xero-tenant-id": tenantId,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Xero API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * Upsert cached data for a given business + entity type.
 * Deletes existing cache entry then inserts new one.
 * Also creates a snapshot if the data has changed.
 */
function upsertCache(
  businessId: string,
  entityType: XeroEntityType,
  data: unknown
): void {
  const db = getDb();
  const jsonData = JSON.stringify(data);

  // Delete existing cache for this business + entity type
  db.delete(schema.xeroCache)
    .where(
      and(
        eq(schema.xeroCache.business_id, businessId),
        eq(schema.xeroCache.entity_type, entityType)
      )
    )
    .run();

  // Insert new cache entry
  db.insert(schema.xeroCache)
    .values({
      id: uuid(),
      business_id: businessId,
      entity_type: entityType,
      data: jsonData,
      synced_at: new Date(),
    })
    .run();

  // Create snapshot if data changed
  maybeCreateSnapshot(businessId, entityType, jsonData);
}

/**
 * Hash the JSON data and store a new snapshot only if
 * the hash differs from the most recent snapshot.
 */
function maybeCreateSnapshot(
  businessId: string,
  entityType: XeroEntityType,
  jsonData: string
): string | null {
  const db = getDb();
  const dataHash = createHash("sha256").update(jsonData).digest("hex");

  // Check latest snapshot hash
  const latest = db
    .select({ data_hash: schema.xeroSnapshots.data_hash })
    .from(schema.xeroSnapshots)
    .where(
      and(
        eq(schema.xeroSnapshots.business_id, businessId),
        eq(schema.xeroSnapshots.entity_type, entityType)
      )
    )
    .orderBy(desc(schema.xeroSnapshots.synced_at))
    .limit(1)
    .get();

  if (latest?.data_hash === dataHash) return null;

  const id = uuid();
  db.insert(schema.xeroSnapshots)
    .values({
      id,
      business_id: businessId,
      entity_type: entityType,
      data: jsonData,
      data_hash: dataHash,
      synced_at: new Date(),
    })
    .run();

  return id;
}

/**
 * Remove snapshots older than the specified number of months.
 */
export function pruneOldSnapshots(
  businessId: string,
  monthsToKeep: number = 12
): void {
  const db = getDb();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsToKeep);

  db.delete(schema.xeroSnapshots)
    .where(
      and(
        eq(schema.xeroSnapshots.business_id, businessId),
        lt(schema.xeroSnapshots.synced_at, cutoff)
      )
    )
    .run();
}

export async function syncProfitAndLoss(
  businessId: string
): Promise<SyncResult> {
  try {
    const { accessToken, tenantId } = await getAuthedClient(businessId);
    const data = await xeroGet(
      accessToken,
      tenantId,
      "/api.xro/2.0/Reports/ProfitAndLoss"
    );
    upsertCache(businessId, "profit_loss", data);
    return { entityType: "profit_loss", success: true };
  } catch (error) {
    return {
      entityType: "profit_loss",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function syncBalanceSheet(
  businessId: string
): Promise<SyncResult> {
  try {
    const { accessToken, tenantId } = await getAuthedClient(businessId);
    const data = await xeroGet(
      accessToken,
      tenantId,
      "/api.xro/2.0/Reports/BalanceSheet"
    );
    upsertCache(businessId, "balance_sheet", data);
    return { entityType: "balance_sheet", success: true };
  } catch (error) {
    return {
      entityType: "balance_sheet",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function syncBankAccounts(
  businessId: string
): Promise<SyncResult> {
  try {
    const { accessToken, tenantId } = await getAuthedClient(businessId);
    const data = await xeroGet(
      accessToken,
      tenantId,
      '/api.xro/2.0/Accounts?where=Type%3D%3D%22BANK%22'
    );
    upsertCache(businessId, "bank_accounts", data);
    return { entityType: "bank_accounts", success: true };
  } catch (error) {
    return {
      entityType: "bank_accounts",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function syncInvoices(businessId: string): Promise<SyncResult> {
  try {
    const { accessToken, tenantId } = await getAuthedClient(businessId);
    const data = await xeroGet(
      accessToken,
      tenantId,
      '/api.xro/2.0/Invoices?where=Status%21%3D%22DELETED%22&order=Date%20DESC&page=1'
    );
    upsertCache(businessId, "invoices", data);
    return { entityType: "invoices", success: true };
  } catch (error) {
    return {
      entityType: "invoices",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function syncContacts(businessId: string): Promise<SyncResult> {
  try {
    const { accessToken, tenantId } = await getAuthedClient(businessId);
    const data = await xeroGet(
      accessToken,
      tenantId,
      "/api.xro/2.0/Contacts?page=1"
    );
    upsertCache(businessId, "contacts", data);
    return { entityType: "contacts", success: true };
  } catch (error) {
    return {
      entityType: "contacts",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function syncMonthlyProfitAndLoss(
  businessId: string
): Promise<SyncResult> {
  try {
    const { accessToken, tenantId } = await getAuthedClient(businessId);
    const data = await xeroGet(
      accessToken,
      tenantId,
      "/api.xro/2.0/Reports/ProfitAndLoss?periods=11&timeframe=MONTH"
    );
    upsertCache(businessId, "profit_loss_monthly", data);
    return { entityType: "profit_loss_monthly" as XeroEntityType, success: true };
  } catch (error) {
    return {
      entityType: "profit_loss_monthly" as XeroEntityType,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Sync all data types from Xero. Each sync is independent;
 * one failure does not halt the others.
 */
export async function syncAllData(
  businessId: string
): Promise<SyncResult[]> {
  const results = await Promise.all([
    syncProfitAndLoss(businessId),
    syncMonthlyProfitAndLoss(businessId),
    syncBalanceSheet(businessId),
    syncBankAccounts(businessId),
    syncInvoices(businessId),
    syncContacts(businessId),
  ]);

  return results;
}
