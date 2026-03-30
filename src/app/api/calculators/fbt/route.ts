import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { fbtReturns } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateFBT } from "@/lib/calculators/fbt";
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

  if (!business.has_employees) {
    return NextResponse.json({ error: "FBT not applicable — no employees" }, { status: 400 });
  }

  const url = new URL(request.url);
  const taxYear = url.searchParams.get("tax_year") || String(getNzTaxYear(new Date()));
  const quarter = Number(url.searchParams.get("quarter") || 1);

  const db = getDb();
  const [ret] = await db
    .select()
    .from(fbtReturns)
    .where(
      and(
        eq(fbtReturns.business_id, business.id),
        eq(fbtReturns.tax_year, taxYear),
        eq(fbtReturns.quarter, quarter)
      )
    );

  if (!ret) {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    ...ret,
    benefits: JSON.parse(ret.benefits_json),
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

  if (!business.has_employees) {
    return NextResponse.json({ error: "FBT not applicable — no employees" }, { status: 400 });
  }

  const body = await request.json();
  const { tax_year, quarter, benefits } = body;
  const taxYear = tax_year || String(getNzTaxYear(new Date()));

  const config = getTaxYearConfig(Number(taxYear));
  const result = calculateFBT(benefits || [], config.fbtSingleRate);

  const db = getDb();

  const [existing] = await db
    .select()
    .from(fbtReturns)
    .where(
      and(
        eq(fbtReturns.business_id, business.id),
        eq(fbtReturns.tax_year, taxYear),
        eq(fbtReturns.quarter, quarter || 1)
      )
    );

  if (existing) {
    await db
      .update(fbtReturns)
      .set({
        benefits_json: JSON.stringify(benefits || []),
        total_taxable_value: result.totalTaxableValue,
        fbt_payable: result.fbtPayable,
        updated_at: new Date(),
      })
      .where(eq(fbtReturns.id, existing.id));
  } else {
    await db.insert(fbtReturns).values({
      id: crypto.randomUUID(),
      business_id: business.id,
      tax_year: taxYear,
      quarter: quarter || 1,
      benefits_json: JSON.stringify(benefits || []),
      total_taxable_value: result.totalTaxableValue,
      fbt_payable: result.fbtPayable,
    });
  }

  return NextResponse.json(result);
}
