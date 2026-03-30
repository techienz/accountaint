import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { shareholderTransactions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; txId: string }> }
) {
  const { txId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const body = await request.json();
  const db = getDb();

  const updates: Record<string, unknown> = {};
  if (body.date) updates.date = body.date;
  if (body.type) updates.type = body.type;
  if (body.description !== undefined) updates.description = body.description;
  if (body.amount != null) updates.amount = body.amount;

  await db
    .update(shareholderTransactions)
    .set(updates)
    .where(
      and(
        eq(shareholderTransactions.id, txId),
        eq(shareholderTransactions.business_id, business.id)
      )
    );

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; txId: string }> }
) {
  const { txId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const db = getDb();
  await db
    .delete(shareholderTransactions)
    .where(
      and(
        eq(shareholderTransactions.id, txId),
        eq(shareholderTransactions.business_id, business.id)
      )
    );

  return NextResponse.json({ success: true });
}
