import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { personalIncomeSources } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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
  const shareholderId = url.searchParams.get("shareholder_id");
  const taxYear = url.searchParams.get("tax_year") || String(getNzTaxYear(new Date()));

  if (!shareholderId) {
    return NextResponse.json({ error: "shareholder_id required" }, { status: 400 });
  }

  const db = getDb();
  const sources = await db
    .select()
    .from(personalIncomeSources)
    .where(
      and(
        eq(personalIncomeSources.business_id, business.id),
        eq(personalIncomeSources.shareholder_id, shareholderId),
        eq(personalIncomeSources.tax_year, taxYear)
      )
    );

  return NextResponse.json(sources);
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
  const { shareholder_id, tax_year, source_type, description, amount, tax_paid } = body;

  if (!shareholder_id || !source_type || amount == null) {
    return NextResponse.json(
      { error: "shareholder_id, source_type, and amount are required" },
      { status: 400 }
    );
  }

  const db = getDb();
  const id = crypto.randomUUID();
  const taxYear = tax_year || String(getNzTaxYear(new Date()));

  await db.insert(personalIncomeSources).values({
    id,
    business_id: business.id,
    shareholder_id,
    tax_year: taxYear,
    source_type,
    description: description || null,
    amount,
    tax_paid: tax_paid || 0,
  });

  return NextResponse.json({ id }, { status: 201 });
}
