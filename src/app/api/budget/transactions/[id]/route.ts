import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getTransaction,
  updateTransaction,
  deleteTransaction,
} from "@/lib/budget/transactions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const tx = getTransaction(id, session.user.id);
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(tx);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const tx = updateTransaction(id, session.user.id, {
    category_id: body.category_id !== undefined ? (body.category_id ?? null) : undefined,
    bank_account_id: body.bank_account_id !== undefined ? (body.bank_account_id ?? null) : undefined,
  });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(tx);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const deleted = deleteTransaction(id, session.user.id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
