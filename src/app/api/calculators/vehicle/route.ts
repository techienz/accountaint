import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { vehicleClaims } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateVehicleClaim } from "@/lib/calculators/vehicle";
import { getNzTaxYear, getTaxYearConfig } from "@/lib/tax/rules";

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
  const taxYear = url.searchParams.get("tax_year") || String(getNzTaxYear(new Date()));

  const db = getDb();
  const [claim] = await db
    .select()
    .from(vehicleClaims)
    .where(
      and(
        eq(vehicleClaims.business_id, business.id),
        eq(vehicleClaims.tax_year, taxYear)
      )
    );

  if (!claim) {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    ...claim,
    actual_costs: claim.actual_costs_json ? JSON.parse(claim.actual_costs_json) : null,
  });
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
  const { tax_year, method, total_business_km, business_use_percentage, actual_costs } = body;
  const taxYear = tax_year || String(getNzTaxYear(new Date()));

  const config = getTaxYearConfig(Number(taxYear));

  const result = calculateVehicleClaim(
    method,
    total_business_km || 0,
    config.mileageRate,
    actual_costs || null,
    business_use_percentage || 0
  );

  const db = getDb();

  const [existing] = await db
    .select()
    .from(vehicleClaims)
    .where(
      and(
        eq(vehicleClaims.business_id, business.id),
        eq(vehicleClaims.tax_year, taxYear)
      )
    );

  const values = {
    method,
    total_business_km: total_business_km || null,
    mileage_rate: config.mileageRate,
    business_use_percentage: business_use_percentage || null,
    actual_costs_json: actual_costs ? JSON.stringify(actual_costs) : null,
    total_claim: result.totalClaim,
  };

  if (existing) {
    await db
      .update(vehicleClaims)
      .set({ ...values, updated_at: new Date() })
      .where(eq(vehicleClaims.id, existing.id));
  } else {
    await db.insert(vehicleClaims).values({
      id: crypto.randomUUID(),
      business_id: business.id,
      tax_year: taxYear,
      ...values,
    });
  }

  return NextResponse.json(result);
}
