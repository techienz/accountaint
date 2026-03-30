import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { optimiseSalaryDividend } from "@/lib/tax/salary-dividend-optimiser";
import { getTaxYearConfig, getNzTaxYear } from "@/lib/tax/rules";

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

  const taxYear = getNzTaxYear(new Date());
  const config = getTaxYearConfig(taxYear);

  const result = optimiseSalaryDividend({
    companyProfit,
    companyTaxRate: config.incomeTaxRate.company,
    personalBrackets: config.personalIncomeTaxBrackets,
    otherPersonalIncome: otherIncome,
  });

  return NextResponse.json(result);
}
