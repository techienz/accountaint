import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateFolder, deleteFolder } from "@/lib/documents/folders";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { name, icon } = await request.json();

  const result = updateFolder(id, session.activeBusiness.id, { name, icon });
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = deleteFolder(id, session.activeBusiness.id);
  if (!deleted) return NextResponse.json({ error: "Cannot delete system folder" }, { status: 400 });
  return NextResponse.json({ success: true });
}
