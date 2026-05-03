import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prepareIR10 } from "@/lib/tax/ir10-prep";
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
  const taxYear =
    url.searchParams.get("tax_year") || String(getNzTaxYear(new Date()));

  const data = await prepareIR10(business.id, taxYear);
  return NextResponse.json(data);
}
