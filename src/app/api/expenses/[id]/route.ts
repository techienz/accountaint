import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getExpense, updateExpense, deleteExpense } from "@/lib/expenses";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const expense = getExpense(id, session.activeBusiness.id);
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(expense);
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
  const expense = updateExpense(id, session.activeBusiness.id, body);
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(expense);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const deleted = deleteExpense(id, session.activeBusiness.id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
