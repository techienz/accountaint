import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getInvestment, updateInvestment, deleteInvestment } from "@/lib/budget";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const investment = getInvestment(id, session.user.id);
  if (!investment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(investment);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const investment = updateInvestment(id, session.user.id, body);
  if (!investment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(investment);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const deleted = deleteInvestment(id, session.user.id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
