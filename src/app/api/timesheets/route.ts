import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listTimesheetEntries, createTimesheetEntry } from "@/lib/timesheets";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const filters = {
    workContractId: searchParams.get("work_contract_id") || undefined,
    dateFrom: searchParams.get("date_from") || undefined,
    dateTo: searchParams.get("date_to") || undefined,
    status: searchParams.get("status") || undefined,
  };

  const entries = listTimesheetEntries(session.activeBusiness.id, filters);
  return NextResponse.json(entries);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const body = await request.json();

  const { work_contract_id, date } = body;
  if (!work_contract_id || !date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!body.duration_minutes && !(body.start_time && body.end_time)) {
    return NextResponse.json({ error: "Provide duration or start/end times" }, { status: 400 });
  }

  const entry = createTimesheetEntry(session.activeBusiness.id, {
    work_contract_id,
    date,
    start_time: body.start_time ?? null,
    end_time: body.end_time ?? null,
    duration_minutes: body.duration_minutes ?? null,
    description: body.description ?? null,
    billable: body.billable ?? true,
    hourly_rate: body.hourly_rate ?? null,
  });

  if (!entry) return NextResponse.json({ error: "Work contract not found" }, { status: 404 });

  return NextResponse.json(entry, { status: 201 });
}
