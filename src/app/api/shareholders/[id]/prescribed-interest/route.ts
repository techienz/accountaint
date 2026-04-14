import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { calculatePrescribedInterest } from "@/lib/shareholders/prescribed-interest";
import { getNzTaxYear } from "@/lib/tax/rules";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const taxYear = Number(request.nextUrl.searchParams.get("tax_year")) || getNzTaxYear(new Date());
  const result = calculatePrescribedInterest(session.activeBusiness.id, id, taxYear);
  return NextResponse.json(result);
}
