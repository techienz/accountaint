import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateTimesheetCsv } from "@/lib/timesheets/export";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get("contract_id");
  const weekEnding = searchParams.get("week_ending");

  if (!contractId || !weekEnding) {
    return NextResponse.json(
      { error: "contract_id and week_ending required" },
      { status: 400 }
    );
  }

  try {
    const csv = generateTimesheetCsv({
      businessId: session.activeBusiness.id,
      contractId,
      weekEnding,
      consultantName: session.user.name,
    });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="timesheet-${weekEnding}.csv"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
