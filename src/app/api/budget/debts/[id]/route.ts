import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDebt, updateDebt, deleteDebt } from "@/lib/budget";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const debt = getDebt(id, session.user.id);
  if (!debt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(debt);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const debt = updateDebt(id, session.user.id, body);
  if (!debt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(debt);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const deleted = deleteDebt(id, session.user.id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
