import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { recordLeave, listLeave } from "@/lib/employees/leave";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const records = listLeave(session.activeBusiness.id, id);
  return NextResponse.json(records);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const leaveId = recordLeave(session.activeBusiness.id, id, body);
  return NextResponse.json({ id: leaveId }, { status: 201 });
}
