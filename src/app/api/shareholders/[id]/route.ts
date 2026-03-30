import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { shareholders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/encryption";
import { validateIrdNumber } from "@/lib/tax/ird-validator";

export async function GET(
  _request: NextRequest,
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

  const db = getDb();
  const [row] = await db
    .select()
    .from(shareholders)
    .where(
      and(eq(shareholders.id, id), eq(shareholders.business_id, business.id))
    );

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...row,
    name: decrypt(row.name),
    ird_number: row.ird_number ? decrypt(row.ird_number) : null,
  });
}

export async function PUT(
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

  const body = await request.json();

  if (body.ird_number) {
    const irdResult = validateIrdNumber(body.ird_number);
    if (!irdResult.valid) {
      return NextResponse.json({ error: irdResult.error }, { status: 400 });
    }
  }

  const db = getDb();

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (body.name) updates.name = encrypt(body.name);
  if (body.ird_number !== undefined)
    updates.ird_number = body.ird_number ? encrypt(body.ird_number) : null;
  if (body.ownership_percentage != null)
    updates.ownership_percentage = body.ownership_percentage;
  if (body.is_director != null) updates.is_director = body.is_director;

  await db
    .update(shareholders)
    .set(updates)
    .where(
      and(eq(shareholders.id, id), eq(shareholders.business_id, business.id))
    );

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
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

  const db = getDb();
  await db
    .delete(shareholders)
    .where(
      and(eq(shareholders.id, id), eq(shareholders.business_id, business.id))
    );

  return NextResponse.json({ success: true });
}
