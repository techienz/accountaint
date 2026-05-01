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
  const result = deleteTimesheetEntry(id, session.activeBusiness.id);
  if (!result.ok) {
    if (result.reason === "invoiced") {
      return NextResponse.json(
        {
          error:
            `This timesheet entry is on invoice ${result.invoice_number ?? result.invoice_id}. ` +
            "Void or delete the invoice first to un-invoice these hours, then try again.",
          invoice_id: result.invoice_id,
          invoice_number: result.invoice_number,
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
