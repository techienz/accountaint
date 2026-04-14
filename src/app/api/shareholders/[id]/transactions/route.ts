import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { shareholderTransactions, shareholders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getRunningBalance } from "@/lib/shareholders/balance";
import { postShareholderJournal } from "@/lib/ledger/post";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const taxYear =
    request.nextUrl.searchParams.get("tax_year") || String(new Date().getFullYear());

  const result = await getRunningBalance(id, taxYear, business.id);
  return NextResponse.json(result);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  // Verify shareholder belongs to this business
  const db = getDb();
  const [shareholder] = await db
    .select()
    .from(shareholders)
    .where(
      and(eq(shareholders.id, id), eq(shareholders.business_id, business.id))
    );

  if (!shareholder) {
    return NextResponse.json({ error: "Shareholder not found" }, { status: 404 });
  }

  const body = await request.json();
  const { tax_year, date, type, description, amount } = body;

  if (!tax_year || !date || !type || amount == null) {
    return NextResponse.json(
      { error: "tax_year, date, type, and amount are required" },
      { status: 400 }
    );
  }

  const txId = crypto.randomUUID();
  await db.insert(shareholderTransactions).values({
    id: txId,
    business_id: business.id,
    shareholder_id: id,
    tax_year,
    date,
    type,
    description: description || null,
    amount,
  });

  // Post journal entry
  try {
    postShareholderJournal(business.id, {
      id: txId,
      date,
      type,
      amount,
      description: description || undefined,
    });
  } catch (e) {
    console.error("[ledger] Failed to post shareholder journal:", e);
  }

  return NextResponse.json({ id: txId }, { status: 201 });
}
