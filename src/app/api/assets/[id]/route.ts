import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assets, assetDepreciation } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

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
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, id), eq(assets.business_id, business.id)));

  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const depHistory = await db
    .select()
    .from(assetDepreciation)
    .where(eq(assetDepreciation.asset_id, id))
    .orderBy(desc(assetDepreciation.tax_year));

  return NextResponse.json({ ...asset, depreciationHistory: depHistory });
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
  const db = getDb();

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (body.name) updates.name = body.name;
  if (body.category) updates.category = body.category;
  if (body.notes !== undefined) updates.notes = body.notes;

  await db
    .update(assets)
    .set(updates)
    .where(and(eq(assets.id, id), eq(assets.business_id, business.id)));

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
    .delete(assets)
    .where(and(eq(assets.id, id), eq(assets.business_id, business.id)));

  return NextResponse.json({ success: true });
}
