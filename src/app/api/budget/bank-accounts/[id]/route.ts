import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBankAccount, updateBankAccount, deleteBankAccount } from "@/lib/budget";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const account = getBankAccount(id, session.user.id);
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(account);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const account = updateBankAccount(id, session.user.id, body);
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(account);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const deleted = deleteBankAccount(id, session.user.id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
