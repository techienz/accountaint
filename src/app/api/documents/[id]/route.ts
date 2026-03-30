import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getDocument,
  updateDocument,
  deleteDocument,
} from "@/lib/documents";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const doc = getDocument(id, session.activeBusiness.id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(doc);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const body = await request.json();
  const doc = updateDocument(id, session.activeBusiness.id, body);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(doc);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const deleted = deleteDocument(id, session.activeBusiness.id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
