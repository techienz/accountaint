import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { optimiseSalaryDividend } from "@/lib/tax/salary-dividend-optimiser";
import { getNzTaxYear } from "@/lib/tax/rules";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params; // Consume params to avoid warnings
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const url = new URL(request.url);
  const companyProfit = Number(url.searchParams.get("company_profit") || 100000);
  const otherIncome = Number(url.searchParams.get("other_income") || 0);
  const kiwisaverEnrolled =
    url.searchParams.get("kiwisaver_enrolled") === "true";

  const result = optimiseSalaryDividend({
    companyProfit,
    otherPersonalIncome: otherIncome,
    taxYear: getNzTaxYear(new Date()),
    kiwisaverEnrolled,
  });

  return NextResponse.json(result);
}
