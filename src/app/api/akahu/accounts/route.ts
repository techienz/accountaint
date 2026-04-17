import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { decrypt } from "@/lib/encryption";

/**
 * GET: List all Akahu accounts for the current user.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const accounts = db
    .select()
    .from(schema.akahuAccounts)
    .where(eq(schema.akahuAccounts.user_id, session.user.id))
    .all();

  const decrypted = accounts.map((a) => ({
    id: a.id,
    name: decrypt(a.name),
    institution: decrypt(a.institution),
    account_type: a.account_type,
    balance: a.balance,
    available_balance: a.available_balance,
    last_synced_at: a.last_synced_at?.toISOString() ?? null,
    linked_budget_account_id: a.linked_budget_account_id,
    linked_business_id: a.linked_business_id,
    linked_ledger_account_id: a.linked_ledger_account_id,
    is_tax_savings: a.is_tax_savings,
  }));

  return NextResponse.json({ accounts: decrypted });
}

/**
 * PUT: Link an Akahu account to a personal budget account or business.
 * Body: { accountId, linkType: "personal" | "business" | "none", linkId?: string }
 */
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { accountId, linkType, linkId, is_tax_savings } = body as {
    accountId: string;
    linkType?: "personal" | "business" | "none";
    linkId?: string;
    is_tax_savings?: boolean;
  };

  if (!accountId) {
    return NextResponse.json(
      { error: "accountId is required" },
      { status: 400 }
    );
  }

  // Handle is_tax_savings toggle
  if (is_tax_savings !== undefined) {
    const db = getDb();
    const acct = db.select().from(schema.akahuAccounts).where(eq(schema.akahuAccounts.id, accountId)).get();
    if (!acct || acct.user_id !== session.user.id) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    // Clear any existing tax savings flag for this business first
    if (is_tax_savings && acct.linked_business_id) {
      db.update(schema.akahuAccounts)
        .set({ is_tax_savings: false })
        .where(eq(schema.akahuAccounts.linked_business_id, acct.linked_business_id))
        .run();
    }
    db.update(schema.akahuAccounts)
      .set({ is_tax_savings })
      .where(eq(schema.akahuAccounts.id, accountId))
      .run();
    return NextResponse.json({ success: true });
  }

  if (!linkType) {
    return NextResponse.json(
      { error: "linkType is required" },
      { status: 400 }
    );
  }

  const db = getDb();

  // Verify the account belongs to this user
  const account = db
    .select()
    .from(schema.akahuAccounts)
    .where(eq(schema.akahuAccounts.id, accountId))
    .get();

  if (!account || account.user_id !== session.user.id) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  if (linkType === "personal") {
    if (!linkId) {
      return NextResponse.json(
        { error: "linkId required for personal linking" },
        { status: 400 }
      );
    }
    // Verify budget bank account belongs to this user
    const budgetAccount = db
      .select()
      .from(schema.budgetBankAccounts)
      .where(eq(schema.budgetBankAccounts.id, linkId))
      .get();
    if (!budgetAccount || budgetAccount.user_id !== session.user.id) {
      return NextResponse.json(
        { error: "Budget account not found" },
        { status: 404 }
      );
    }

    db.update(schema.akahuAccounts)
      .set({
        linked_budget_account_id: linkId,
        linked_business_id: null,
        linked_ledger_account_id: null,
      })
      .where(eq(schema.akahuAccounts.id, accountId))
      .run();
  } else if (linkType === "business") {
    if (!linkId) {
      return NextResponse.json(
        { error: "linkId required for business linking" },
        { status: 400 }
      );
    }
    // Verify business belongs to this user
    const business = db
      .select()
      .from(schema.businesses)
      .where(eq(schema.businesses.id, linkId))
      .get();
    if (!business || business.owner_user_id !== session.user.id) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    // Auto-link to Cash at Bank ledger account
    const { getAccountByCode } = await import("@/lib/ledger/accounts");
    const bankAccount = getAccountByCode(linkId, "1100");
    const ledgerAccountId = bankAccount?.id ?? null;

    db.update(schema.akahuAccounts)
      .set({
        linked_budget_account_id: null,
        linked_business_id: linkId,
        linked_ledger_account_id: ledgerAccountId,
      })
      .where(eq(schema.akahuAccounts.id, accountId))
      .run();
  } else {
    // Unlink
    db.update(schema.akahuAccounts)
      .set({
        linked_budget_account_id: null,
        linked_business_id: null,
        linked_ledger_account_id: null,
      })
      .where(eq(schema.akahuAccounts.id, accountId))
      .run();
  }

  return NextResponse.json({ success: true });
}
