import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { hasChartOfAccounts, listAccounts } from "@/lib/ledger/accounts";
import { MigrationWizard } from "./migration-wizard";

export default async function MigrationPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/settings?new=true");

  const db = getDb();
  const businessId = session.activeBusiness.id;

  // Check COA status
  const hasCoa = hasChartOfAccounts(businessId);
  const accountCount = hasCoa ? listAccounts(businessId).length : 0;

  // Check Xero connection status
  const xeroConnection = db
    .select()
    .from(schema.xeroConnections)
    .where(eq(schema.xeroConnections.business_id, businessId))
    .get();
  const isXeroConnected = !!xeroConnection;

  // Check if balance sheet cache exists
  const bsCache = db
    .select({ id: schema.xeroCache.id, synced_at: schema.xeroCache.synced_at })
    .from(schema.xeroCache)
    .where(
      and(
        eq(schema.xeroCache.business_id, businessId),
        eq(schema.xeroCache.entity_type, "balance_sheet")
      )
    )
    .get();
  const hasBalanceSheet = !!bsCache;
  const bsSyncedAt = bsCache?.synced_at?.toISOString() ?? null;

  // Check for existing opening balance journal entries
  const existingOpeningBalance = db
    .select({ id: schema.journalEntries.id })
    .from(schema.journalEntries)
    .where(
      and(
        eq(schema.journalEntries.business_id, businessId),
        eq(schema.journalEntries.source_type, "opening_balance")
      )
    )
    .limit(1)
    .get();
  const hasExistingOpeningBalance = !!existingOpeningBalance;

  return (
    <div className="mx-auto max-w-2xl">
      <MigrationWizard
        hasCoa={hasCoa}
        accountCount={accountCount}
        isXeroConnected={isXeroConnected}
        hasBalanceSheet={hasBalanceSheet}
        bsSyncedAt={bsSyncedAt}
        hasExistingOpeningBalance={hasExistingOpeningBalance}
      />
    </div>
  );
}
