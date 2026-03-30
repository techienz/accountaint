import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getIncome, updateIncome, deleteIncome } from "@/lib/budget";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const income = getIncome(id, session.user.id);
  if (!income) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(income);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const income = updateIncome(id, session.user.id, body);
  if (!income) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(income);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const deleted = deleteIncome(id, session.user.id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
