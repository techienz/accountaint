import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runAnnualDepreciation } from "@/lib/assets/annual-depreciation";
import { getNzTaxYear } from "@/lib/tax/rules";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const taxYear = body.tax_year || String(getNzTaxYear(new Date()));

  const result = await runAnnualDepreciation(business.id, taxYear);
  return NextResponse.json(result);
}
