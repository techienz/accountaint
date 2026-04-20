import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { saveSubscription } from "@/lib/notifications/desktop";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };

  if (
    !body.endpoint ||
    !body.keys ||
    !body.keys.p256dh ||
    !body.keys.auth
  ) {
    return NextResponse.json(
      { error: "endpoint, keys.p256dh, keys.auth all required" },
      { status: 400 }
    );
  }

  saveSubscription(session.user.id, {
    endpoint: body.endpoint,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
  });

  return NextResponse.json({ success: true });
}
