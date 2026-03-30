import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { approveTimesheetEntries } from "@/lib/timesheets";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const body = await request.json();
  const { ids } = body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }

  const approved = approveTimesheetEntries(session.activeBusiness.id, ids);
  return NextResponse.json({ approved });
}
