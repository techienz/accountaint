import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { removeSubscription } from "@/lib/notifications/desktop";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { endpoint?: string };
  if (!body.endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }

  const removed = removeSubscription(session.user.id, body.endpoint);
  return NextResponse.json({ success: true, removed });
}
