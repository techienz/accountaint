import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { taxSavingsTargets } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateTaxSavings } from "@/lib/tax/savings-calculator";
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

  try {
    const result = await calculateTaxSavings(business.id, taxYear);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[tax-savings] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to calculate tax savings" },
      { status: 500 }
    );
  }
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
  const { tax_year, month, actual_set_aside } = body;

  if (!month || actual_set_aside == null) {
    return NextResponse.json(
      { error: "month and actual_set_aside are required" },
      { status: 400 }
    );
  }

  const taxYear = tax_year || String(getNzTaxYear(new Date()));
  const db = getDb();

  // Upsert
  const [existing] = await db
    .select()
    .from(taxSavingsTargets)
    .where(
      and(
        eq(taxSavingsTargets.business_id, business.id),
        eq(taxSavingsTargets.tax_year, taxYear),
        eq(taxSavingsTargets.month, month)
      )
    );

  if (existing) {
    await db
      .update(taxSavingsTargets)
      .set({ actual_set_aside, updated_at: new Date() })
      .where(eq(taxSavingsTargets.id, existing.id));
  } else {
    await db.insert(taxSavingsTargets).values({
      id: crypto.randomUUID(),
      business_id: business.id,
      tax_year: taxYear,
      month,
      gst_component: 0,
      income_tax_component: 0,
      total_target: 0,
      actual_set_aside,
    });
  }

  return NextResponse.json({ success: true });
}
