import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { listAccounts } from "@/lib/ledger/accounts";

type SubType = "current_asset" | "fixed_asset" | "current_liability" | "long_term_liability" | "equity" | "revenue" | "cogs" | "expense";

const SUB_TYPE_MAP: Record<string, SubType> = {
  asset: "current_asset",
  liability: "current_liability",
  equity: "equity",
  revenue: "revenue",
  expense: "expense",
};

export async function GET() {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(listAccounts(session.activeBusiness.id));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { code, name, type } = body as { code: string; name: string; type: "asset" | "liability" | "equity" | "revenue" | "expense" };
  if (!code || !name || !type) {
    return NextResponse.json({ error: "code, name, and type are required" }, { status: 400 });
  }

  const db = getDb();
  const businessId = session.activeBusiness.id;

  // Check for duplicate code
  const existing = db
    .select()
    .from(schema.accounts)
    .where(
      and(
        eq(schema.accounts.business_id, businessId),
        eq(schema.accounts.code, code)
      )
    )
    .get();

  if (existing) {
    return NextResponse.json({ error: `Account code ${code} already exists` }, { status: 400 });
  }

  const id = uuid();
  db.insert(schema.accounts)
    .values({
      id,
      business_id: businessId,
      code,
      name,
      type,
      sub_type: SUB_TYPE_MAP[type] || "expense",
      is_system: false,
      gst_applicable: type === "revenue" || type === "expense",
    })
    .run();

  return NextResponse.json({ id }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accountId, is_active } = await request.json();
  if (!accountId || is_active === undefined) {
    return NextResponse.json({ error: "accountId and is_active required" }, { status: 400 });
  }

  const db = getDb();
  const account = db
    .select()
    .from(schema.accounts)
    .where(
      and(
        eq(schema.accounts.id, accountId),
        eq(schema.accounts.business_id, session.activeBusiness.id)
      )
    )
    .get();

  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (account.is_system) return NextResponse.json({ error: "Cannot modify system accounts" }, { status: 400 });

  db.update(schema.accounts)
    .set({ is_active, updated_at: new Date() })
    .where(eq(schema.accounts.id, accountId))
    .run();

  return NextResponse.json({ success: true });
}
