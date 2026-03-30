import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { calculateDeadlines } from "@/lib/tax/deadlines";
import type { DeadlineInput } from "@/lib/tax/deadlines";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json(
      { error: "No active business selected" },
      { status: 400 }
    );
  }

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from);
  to.setFullYear(to.getFullYear() + 1);

  const input: DeadlineInput = {
    entity_type: business.entity_type as DeadlineInput["entity_type"],
    balance_date: business.balance_date,
    gst_registered: business.gst_registered,
    gst_filing_period: business.gst_filing_period as DeadlineInput["gst_filing_period"],
    has_employees: business.has_employees,
    paye_frequency: business.paye_frequency as DeadlineInput["paye_frequency"],
    provisional_tax_method: business.provisional_tax_method as DeadlineInput["provisional_tax_method"],
    dateRange: { from, to },
  };

  const deadlines = calculateDeadlines(input);
  return NextResponse.json({ deadlines });
}
