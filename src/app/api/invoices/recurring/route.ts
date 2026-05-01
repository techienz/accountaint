import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createRecurringSchedule,
  listRecurringSchedules,
} from "@/lib/invoices/recurring";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const schedules = listRecurringSchedules(session.activeBusiness.id);
  return NextResponse.json(schedules);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const body = await request.json();
  if (!body?.contact_id) return NextResponse.json({ error: "contact_id is required" }, { status: 400 });
  if (!body?.name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!body?.frequency) return NextResponse.json({ error: "frequency is required" }, { status: 400 });
  if (!body?.next_run_date) return NextResponse.json({ error: "next_run_date is required" }, { status: 400 });
  if (!Array.isArray(body?.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: "at least one line item is required" }, { status: 400 });
  }

  try {
    const schedule = createRecurringSchedule(session.activeBusiness.id, body);
    return NextResponse.json(schedule, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create schedule";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
