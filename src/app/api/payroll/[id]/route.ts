import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPayRun, recalculatePayRunLine, deletePayRun } from "@/lib/payroll";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const payRun = getPayRun(id, session.activeBusiness.id);
  if (!payRun) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(payRun);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json();
  const { lineId, hours } = body;

  const result = recalculatePayRunLine(id, lineId, session.activeBusiness.id, { hours });
  if (!result) return NextResponse.json({ error: "Not found or already finalised" }, { status: 400 });
  return NextResponse.json(result);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const deleted = deletePayRun(id, session.activeBusiness.id);
  if (!deleted) return NextResponse.json({ error: "Cannot delete finalised pay run" }, { status: 400 });
  return NextResponse.json({ success: true });
}
