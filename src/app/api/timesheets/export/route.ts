import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateTimesheetCsv, generateTimesheetXlsx } from "@/lib/timesheets/export";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get("contract_id");
  const dateFrom = searchParams.get("date_from") || searchParams.get("week_ending");
  const dateTo = searchParams.get("date_to") || searchParams.get("week_ending");
  const format = searchParams.get("format") || "csv";

  if (!contractId || !dateTo) {
    return NextResponse.json(
      { error: "contract_id and date range required" },
      { status: 400 }
    );
  }

  // If only week_ending provided (backwards compat), calculate week start
  let from = dateFrom!;
  if (searchParams.get("week_ending") && !searchParams.get("date_from")) {
    const end = new Date(dateTo);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    const y = start.getFullYear();
    const m = String(start.getMonth() + 1).padStart(2, "0");
    const d = String(start.getDate()).padStart(2, "0");
    from = `${y}-${m}-${d}`;
  }

  const options = {
    businessId: session.activeBusiness.id,
    contractId,
    dateFrom: from,
    dateTo: dateTo!,
    consultantName: session.user.name,
  };

  try {
    if (format === "xlsx") {
      const buffer = await generateTimesheetXlsx(options);
      return new NextResponse(buffer.buffer as ArrayBuffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="timesheet-${dateTo}.xlsx"`,
        },
      });
    }

    const csv = generateTimesheetCsv(options);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="timesheet-${dateTo}.csv"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
