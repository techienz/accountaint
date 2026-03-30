import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getContract, updateContract, deleteContract } from "@/lib/contracts";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const contract = getContract(id, session.activeBusiness.id);
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(contract);
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
  const contract = updateContract(id, session.activeBusiness.id, body);
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(contract);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const deleted = deleteContract(id, session.activeBusiness.id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
