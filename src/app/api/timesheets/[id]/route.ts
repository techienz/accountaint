import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTimesheetEntry, updateTimesheetEntry, deleteTimesheetEntry } from "@/lib/timesheets";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const entry = getTimesheetEntry(id, session.activeBusiness.id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(entry);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const body = await request.json();
  const entry = updateTimesheetEntry(id, session.activeBusiness.id, body);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(entry);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const deleted = deleteTimesheetEntry(id, session.activeBusiness.id);
  if (!deleted) return NextResponse.json({ error: "Not found or not deletable" }, { status: 404 });

  return NextResponse.json({ success: true });
}
