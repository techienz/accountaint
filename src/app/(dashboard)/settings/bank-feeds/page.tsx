import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { isIntegrationConfigured } from "@/lib/integrations/config";
import { BankFeedsClient } from "./bank-feeds-client";

export default async function BankFeedsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const db = getDb();
  const userId = session.user.id;

  // Check Akahu connection
  const connection = db
    .select()
    .from(schema.akahuConnections)
    .where(eq(schema.akahuConnections.user_id, userId))
    .get();

  const isConnected = !!connection;

  // Get Akahu accounts
  const accounts = isConnected
    ? db
        .select()
        .from(schema.akahuAccounts)
        .where(eq(schema.akahuAccounts.user_id, userId))
        .all()
        .map((a) => ({
          id: a.id,
          name: decrypt(a.name),
          institution: decrypt(a.institution),
          account_type: a.account_type,
          balance: a.balance,
          available_balance: a.available_balance,
          last_synced_at: a.last_synced_at?.toISOString() ?? null,
          linked_budget_account_id: a.linked_budget_account_id,
          linked_business_id: a.linked_business_id,
        }))
    : [];

  // Get budget bank accounts for personal linking options
  const budgetAccounts = db
    .select()
    .from(schema.budgetBankAccounts)
    .where(eq(schema.budgetBankAccounts.user_id, userId))
    .all()
    .map((a) => ({
      id: a.id,
      name: decrypt(a.name),
    }));

  // Get businesses for business linking options
  const businesses = db
    .select()
    .from(schema.businesses)
    .where(eq(schema.businesses.owner_user_id, userId))
    .all()
    .map((b) => ({
      id: b.id,
      name: b.name,
    }));

  return (
    <div className="mx-auto max-w-2xl">
      <BankFeedsClient
        isConnected={isConnected}
        isConfigured={isIntegrationConfigured("akahu", ["app_token", "user_token"])}
        accounts={accounts}
        budgetAccounts={budgetAccounts}
        businesses={businesses}
      />
    </div>
  );
}
