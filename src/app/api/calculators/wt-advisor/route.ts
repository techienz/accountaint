import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { calculateRecommendedWtRate } from "@/lib/calculators/wt-advisor";
import { getNzTaxYear } from "@/lib/tax/rules";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.activeBusiness) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const body = await request.json();
  const {
    contractIncome = 0,
    otherEmploymentIncome = 0,
    otherIncome = 0,
    claimableExpenses = 0,
    hasStudentLoan = false,
    includeAccLevy = true,
  } = body;

  const taxYear = body.taxYear || getNzTaxYear(new Date());

  const result = calculateRecommendedWtRate({
    contractIncome: Math.max(0, Number(contractIncome) || 0),
    otherEmploymentIncome: Math.max(0, Number(otherEmploymentIncome) || 0),
    otherIncome: Math.max(0, Number(otherIncome) || 0),
    claimableExpenses: Math.max(0, Number(claimableExpenses) || 0),
    hasStudentLoan: Boolean(hasStudentLoan),
    includeAccLevy: Boolean(includeAccLevy),
    taxYear,
  });

  return NextResponse.json(result);
}
