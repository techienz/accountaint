import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { XeroSettingsClient } from "./xero-settings-client";

export default async function XeroSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/settings?new=true");

  const db = getDb();
  const businessId = session.activeBusiness.id;

  const connection = db
    .select()
    .from(schema.xeroConnections)
    .where(eq(schema.xeroConnections.business_id, businessId))
    .get();

  let lastSyncAt: Date | null = null;
  if (connection) {
    const latestCache = db
      .select()
      .from(schema.xeroCache)
      .where(eq(schema.xeroCache.business_id, businessId))
      .limit(1)
      .get();
    if (latestCache) {
      lastSyncAt = latestCache.synced_at;
    }
  }

  const isConnected = !!connection;
  const tenantName = connection?.tenant_name ?? null;
  const isStale =
    lastSyncAt != null &&
    Date.now() - lastSyncAt.getTime() > 2 * 60 * 60 * 1000;

  return (
    <div className="mx-auto max-w-2xl">
      <XeroSettingsClient
        isConnected={isConnected}
        tenantName={tenantName}
        lastSyncAt={lastSyncAt?.toISOString() ?? null}
        isStale={isStale}
      />
    </div>
  );
}
