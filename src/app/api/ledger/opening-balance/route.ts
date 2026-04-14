import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasChartOfAccounts } from "@/lib/ledger/accounts";
import { getExistingOpeningBalance, createOpeningBalance } from "@/lib/ledger/opening-balance";

export async function GET() {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = session.activeBusiness.id;
  const hasCoa = hasChartOfAccounts(businessId);
  const existing = getExistingOpeningBalance(businessId);

  return NextResponse.json({
    hasCoa,
    hasExisting: !!existing,
    existingDate: existing?.date ?? null,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = session.activeBusiness.id;

  if (!hasChartOfAccounts(businessId)) {
    return NextResponse.json(
      { error: "Chart of Accounts must be set up first" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const result = createOpeningBalance(businessId, body);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, journalEntryId: result.journalEntryId });
}
