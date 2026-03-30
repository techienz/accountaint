import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { saveSubscription } from "@/lib/notifications/desktop";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  saveSubscription(session.user.id, body);
  return NextResponse.json({ success: true });
}
