import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { countSubscriptions, getVapidPublicKey } from "@/lib/notifications/desktop";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vapidPublicKey = getVapidPublicKey();
  if (!vapidPublicKey) {
    return NextResponse.json({
      configured: false,
      subscription_count: 0,
      vapid_public_key: null,
    });
  }

  return NextResponse.json({
    configured: true,
    subscription_count: countSubscriptions(session.user.id),
    vapid_public_key: vapidPublicKey,
  });
}
