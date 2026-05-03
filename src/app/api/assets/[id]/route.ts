import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assets, assetDepreciation } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  parseNewClassification,
  recomputeAssetIb,
} from "@/lib/assets/investment-boost";

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

  // Investment Boost classification (#148). If the user changes is_new or
  // is_residential, recompute IB and persist the new claim. Read the
  // current row first so we can fall back to its values for fields the
  // PUT body didn't touch.
  const ibTouched =
    body.is_new_classification !== undefined ||
    body.is_residential_building !== undefined;
  if (ibTouched) {
    const [current] = await db
      .select()
      .from(assets)
      .where(and(eq(assets.id, id), eq(assets.business_id, business.id)));
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let nextIsNew = current.is_new;
    let nextIsNewToNz = current.is_new_to_nz;
    if (body.is_new_classification !== undefined) {
      const parsed = parseNewClassification(body.is_new_classification);
      nextIsNew = parsed.is_new;
      nextIsNewToNz = parsed.is_new_to_nz;
    }
    const nextIbExcluded =
      body.is_residential_building !== undefined
        ? body.is_residential_building === "yes"
        : current.ib_excluded;

    const ib = recomputeAssetIb({
      name: current.name,
      cost: current.cost,
      purchase_date: current.purchase_date,
      is_new: nextIsNew,
      is_new_to_nz: nextIsNewToNz,
      ib_excluded: nextIbExcluded,
    });

    updates.is_new = nextIsNew;
    updates.is_new_to_nz = nextIsNewToNz;
    updates.ib_excluded = nextIbExcluded;
    updates.ib_claimed_amount = ib.ib_claimed_amount;
    updates.ib_claimed_tax_year = ib.ib_claimed_tax_year;
  }

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
