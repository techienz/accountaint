import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTimesheetSummary } from "@/lib/timesheets";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const dateFrom = searchParams.get("date_from") || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const dateTo = searchParams.get("date_to") || now.toISOString().slice(0, 10);

  const summary = getTimesheetSummary(session.activeBusiness.id, dateFrom, dateTo);
  return NextResponse.json(summary);
}
