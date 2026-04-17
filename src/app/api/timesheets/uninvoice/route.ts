import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { uninvoiceTimesheetEntries } from "@/lib/timesheets";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ids } = await request.json();
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }

  const count = uninvoiceTimesheetEntries(session.activeBusiness.id, ids);
  return NextResponse.json({ success: true, count });
}
