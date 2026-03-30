import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { markNotificationRead } from "@/lib/notifications/in-app";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !session.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  if (body.read) {
    markNotificationRead(id, session.activeBusiness.id);
  }

  return NextResponse.json({ success: true });
}
