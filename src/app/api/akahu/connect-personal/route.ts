import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { fetchAccounts } from "@/lib/akahu/client";
import { encrypt } from "@/lib/encryption";
import { isIntegrationConfigured } from "@/lib/integrations/config";

/**
 * POST: Connect a personal Akahu app.
 * No OAuth flow needed — uses the stored user token + app token directly.
 * Tests the connection by fetching accounts, then stores the connection.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isIntegrationConfigured("akahu", ["app_token", "user_token"])) {
    return NextResponse.json(
      { error: "Akahu tokens not configured. Enter them in Settings > Bank Feeds." },
      { status: 400 }
    );
  }

  // Test the connection by fetching accounts
  let accounts;
  try {
    accounts = await fetchAccounts(null);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ error: `Akahu connection test failed: ${message}` }, { status: 400 });
  }

  const db = getDb();
  const userId = session.user.id;

  // Check if already connected
  let connectionId: string;
  const existing = db
    .select()
    .from(schema.akahuConnections)
    .where(eq(schema.akahuConnections.user_id, userId))
    .get();

  if (existing) {
    connectionId = existing.id;
  } else {
    connectionId = uuid();
    db.insert(schema.akahuConnections)
      .values({
        id: connectionId,
        user_id: userId,
        access_token: encrypt("personal_app"),
      })
      .run();
  }

  // Sync accounts
  for (const acct of accounts) {
    const existingAcct = db
      .select()
      .from(schema.akahuAccounts)
      .where(eq(schema.akahuAccounts.id, acct._id))
      .get();

    if (!existingAcct) {
      db.insert(schema.akahuAccounts)
        .values({
          id: acct._id,
          akahu_connection_id: connectionId,
          user_id: userId,
          name: encrypt(acct.name),
          institution: encrypt(acct.connection?.name || "Unknown"),
          account_type: acct.type || "SAVINGS",
          balance: acct.balance?.current ?? 0,
          available_balance: acct.balance?.available ?? null,
          last_synced_at: new Date(),
        })
        .run();
    } else {
      db.update(schema.akahuAccounts)
        .set({
          name: encrypt(acct.name),
          institution: encrypt(acct.connection?.name || "Unknown"),
          balance: acct.balance?.current ?? 0,
          available_balance: acct.balance?.available ?? null,
          last_synced_at: new Date(),
        })
        .where(eq(schema.akahuAccounts.id, existingAcct.id))
        .run();
    }
  }

  return NextResponse.json({
    success: true,
    accountCount: accounts.length,
  });
}
