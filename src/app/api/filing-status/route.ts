import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { filingStatus } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const url = new URL(request.url);
  const filingType = url.searchParams.get("type");

  const db = getDb();
  let query = db
    .select()
    .from(filingStatus)
    .where(eq(filingStatus.business_id, business.id));

  const rows = await query;
  const filtered = filingType
    ? rows.filter((r) => r.filing_type === filingType)
    : rows;

  return NextResponse.json(filtered);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const body = await request.json();
  const {
    filing_type,
    period_key,
    shareholder_id,
    status,
    filed_date,
    data_snapshot,
    notes,
  } = body;

  if (!filing_type || !period_key) {
    return NextResponse.json(
      { error: "filing_type and period_key are required" },
      { status: 400 }
    );
  }

  const db = getDb();

  // Find existing record
  const all = await db
    .select()
    .from(filingStatus)
    .where(
      and(
        eq(filingStatus.business_id, business.id),
        eq(filingStatus.filing_type, filing_type),
        eq(filingStatus.period_key, period_key)
      )
    );

  const existing = shareholder_id
    ? all.find((r) => r.shareholder_id === shareholder_id)
    : all.find((r) => !r.shareholder_id);

  if (existing) {
    await db
      .update(filingStatus)
      .set({
        status: status || existing.status,
        filed_date: filed_date || existing.filed_date,
        data_snapshot: data_snapshot
          ? JSON.stringify(data_snapshot)
          : existing.data_snapshot,
        notes: notes ?? existing.notes,
        updated_at: new Date(),
      })
      .where(eq(filingStatus.id, existing.id));
  } else {
    await db.insert(filingStatus).values({
      id: uuid(),
      business_id: business.id,
      filing_type,
      period_key,
      shareholder_id: shareholder_id || null,
      status: status || "not_started",
      filed_date: filed_date || null,
      data_snapshot: data_snapshot ? JSON.stringify(data_snapshot) : null,
      notes: notes || null,
    });
  }

  return NextResponse.json({ success: true });
}
