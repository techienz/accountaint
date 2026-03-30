import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getHoliday, updateHoliday, deleteHoliday } from "@/lib/budget";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const holiday = getHoliday(id, session.user.id);
  if (!holiday) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(holiday);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const holiday = updateHoliday(id, session.user.id, body);
  if (!holiday) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(holiday);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const deleted = deleteHoliday(id, session.user.id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
