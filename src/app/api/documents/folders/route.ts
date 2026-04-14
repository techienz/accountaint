import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listFolders, createFolder } from "@/lib/documents/folders";

export async function GET() {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = listFolders(session.activeBusiness.id);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, icon } = await request.json();
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const folder = createFolder(session.activeBusiness.id, { name, icon });
  return NextResponse.json(folder, { status: 201 });
}
