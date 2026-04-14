import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * Check if a business has an active Xero connection.
 * Used throughout the app to gate Xero-specific UI and behaviour.
 */
export function hasXeroConnection(businessId: string): boolean {
  const db = getDb();
  const row = db
    .select({ id: schema.xeroConnections.id })
    .from(schema.xeroConnections)
    .where(eq(schema.xeroConnections.business_id, businessId))
    .limit(1)
    .get();
  return !!row;
}
