import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { revokeToken } from "@/lib/akahu/client";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const userId = session.user.id;

  // Try to revoke the token with Akahu
  const connection = db
    .select()
    .from(schema.akahuConnections)
    .where(eq(schema.akahuConnections.user_id, userId))
    .get();

  if (connection) {
    try {
      const storedToken = decrypt(connection.access_token);
      // Personal apps don't have a revocable OAuth token
      if (storedToken !== "personal_app") {
        await revokeToken(storedToken);
      }
    } catch (err) {
      console.error("Failed to revoke Akahu token:", err);
    }
  }

  // Delete all Akahu accounts (cascade from connection handles this,
  // but also clean up bank_transactions linked to these accounts)
  const accounts = db
    .select()
    .from(schema.akahuAccounts)
    .where(eq(schema.akahuAccounts.user_id, userId))
    .all();

  for (const account of accounts) {
    if (account.linked_business_id) {
      db.delete(schema.bankTransactions)
        .where(eq(schema.bankTransactions.akahu_account_id, account.id))
        .run();
    }
  }

  // Delete connection (cascades to akahu_accounts)
  db.delete(schema.akahuConnections)
    .where(eq(schema.akahuConnections.user_id, userId))
    .run();

  return NextResponse.json({ success: true });
}
