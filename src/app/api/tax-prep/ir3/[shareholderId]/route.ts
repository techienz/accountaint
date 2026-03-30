import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { incomeTaxPrep } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { prepareIR3 } from "@/lib/tax/ir3-prep";
import { getNzTaxYear } from "@/lib/tax/rules";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shareholderId: string }> }
) {
  const { shareholderId } = await params;
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

  const data = await prepareIR3(shareholderId, taxYear, business.id);
  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shareholderId: string }> }
) {
  const { shareholderId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const body = await request.json();
  const { tax_year, status, data_json } = body;
  const taxYear = tax_year || String(getNzTaxYear(new Date()));

  const db = getDb();

  const [existing] = await db
    .select()
    .from(incomeTaxPrep)
    .where(
      and(
        eq(incomeTaxPrep.business_id, business.id),
        eq(incomeTaxPrep.tax_year, taxYear),
        eq(incomeTaxPrep.return_type, "IR3"),
        eq(incomeTaxPrep.shareholder_id, shareholderId)
      )
    );

  if (existing) {
    await db
      .update(incomeTaxPrep)
      .set({
        status: status || existing.status,
        data_json: data_json ? JSON.stringify(data_json) : existing.data_json,
        updated_at: new Date(),
      })
      .where(eq(incomeTaxPrep.id, existing.id));
  } else {
    await db.insert(incomeTaxPrep).values({
      id: crypto.randomUUID(),
      business_id: business.id,
      tax_year: taxYear,
      return_type: "IR3",
      shareholder_id: shareholderId,
      status: status || "draft",
      data_json: data_json ? JSON.stringify(data_json) : null,
    });
  }

  return NextResponse.json({ success: true });
}
