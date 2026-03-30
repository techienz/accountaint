import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getOneOffExpense, updateOneOffExpense, deleteOneOffExpense } from "@/lib/budget";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const expense = getOneOffExpense(id, session.user.id);
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(expense);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const expense = updateOneOffExpense(id, session.user.id, body);
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(expense);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const deleted = deleteOneOffExpense(id, session.user.id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
