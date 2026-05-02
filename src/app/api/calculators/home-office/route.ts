import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { homeOfficeClaims } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateHomeOffice } from "@/lib/calculators/home-office";
import { getNzTaxYear } from "@/lib/tax/rules";

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
    .from(homeOfficeClaims)
    .where(
      and(
        eq(homeOfficeClaims.business_id, business.id),
        eq(homeOfficeClaims.tax_year, taxYear)
      )
    );

  if (!claim) {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    ...claim,
    costs: JSON.parse(claim.costs_json),
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
  const { tax_year, method, office_area_sqm, total_area_sqm, costs } = body;
  const taxYear = tax_year || String(getNzTaxYear(new Date()));

  const result = calculateHomeOffice(
    method,
    office_area_sqm,
    total_area_sqm,
    costs,
    Number(taxYear), // pass through so sqm_rate uses the right per-m² IRD rate
  );

  const db = getDb();

  // Upsert
  const [existing] = await db
    .select()
    .from(homeOfficeClaims)
    .where(
      and(
        eq(homeOfficeClaims.business_id, business.id),
        eq(homeOfficeClaims.tax_year, taxYear)
      )
    );

  if (existing) {
    await db
      .update(homeOfficeClaims)
      .set({
        method,
        office_area_sqm,
        total_area_sqm,
        costs_json: JSON.stringify(costs),
        total_claim: result.totalClaim,
        updated_at: new Date(),
      })
      .where(eq(homeOfficeClaims.id, existing.id));
  } else {
    await db.insert(homeOfficeClaims).values({
      id: crypto.randomUUID(),
      business_id: business.id,
      tax_year: taxYear,
      method,
      office_area_sqm,
      total_area_sqm,
      costs_json: JSON.stringify(costs),
      total_claim: result.totalClaim,
    });
  }

  return NextResponse.json(result);
}
