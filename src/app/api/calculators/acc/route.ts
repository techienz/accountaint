import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { accConfig } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { estimateACCLevy } from "@/lib/calculators/acc";
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
  const [config] = await db
    .select()
    .from(accConfig)
    .where(
      and(
        eq(accConfig.business_id, business.id),
        eq(accConfig.tax_year, taxYear)
      )
    );

  return NextResponse.json(config || null);
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
  const { tax_year, cu_code, cu_description, liable_earnings, levy_rate, actual_levy } = body;
  const taxYear = tax_year || String(getNzTaxYear(new Date()));

  const result = estimateACCLevy(liable_earnings || 0, levy_rate || 0);

  const db = getDb();

  const [existing] = await db
    .select()
    .from(accConfig)
    .where(
      and(
        eq(accConfig.business_id, business.id),
        eq(accConfig.tax_year, taxYear)
      )
    );

  if (existing) {
    await db
      .update(accConfig)
      .set({
        cu_code: cu_code || existing.cu_code,
        cu_description: cu_description || existing.cu_description,
        liable_earnings: liable_earnings ?? existing.liable_earnings,
        levy_rate: levy_rate ?? existing.levy_rate,
        estimated_levy: result.estimatedLevy,
        actual_levy: actual_levy ?? existing.actual_levy,
        updated_at: new Date(),
      })
      .where(eq(accConfig.id, existing.id));
  } else {
    await db.insert(accConfig).values({
      id: crypto.randomUUID(),
      business_id: business.id,
      tax_year: taxYear,
      cu_code: cu_code || null,
      cu_description: cu_description || null,
      liable_earnings: liable_earnings || 0,
      levy_rate: levy_rate || 0,
      estimated_levy: result.estimatedLevy,
      actual_levy: actual_levy || null,
    });
  }

  return NextResponse.json(result);
}
