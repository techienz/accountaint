import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { vehicleLogbookEntries, vehicleClaims } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

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
  const claimId = url.searchParams.get("claim_id");
  if (!claimId) {
    return NextResponse.json({ error: "claim_id required" }, { status: 400 });
  }

  const db = getDb();
  const entries = await db
    .select()
    .from(vehicleLogbookEntries)
    .where(
      and(
        eq(vehicleLogbookEntries.business_id, business.id),
        eq(vehicleLogbookEntries.vehicle_claim_id, claimId)
      )
    )
    .orderBy(desc(vehicleLogbookEntries.date));

  return NextResponse.json(entries);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const body = await request.json();
  const { vehicle_claim_id, date, from_location, to_location, km, purpose, is_business } = body;

  if (!vehicle_claim_id || !date || !from_location || !to_location || km == null) {
    return NextResponse.json(
      { error: "vehicle_claim_id, date, from_location, to_location, and km are required" },
      { status: 400 }
    );
  }

  const db = getDb();
  const id = crypto.randomUUID();

  await db.insert(vehicleLogbookEntries).values({
    id,
    business_id: business.id,
    vehicle_claim_id,
    date,
    from_location,
    to_location,
    km,
    purpose: purpose || null,
    is_business: is_business ?? true,
  });

  return NextResponse.json({ id }, { status: 201 });
}
