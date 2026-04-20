import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  countSubscriptions,
  sendPushToUser,
} from "@/lib/notifications/desktop";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = countSubscriptions(session.user.id);
  if (count === 0) {
    return NextResponse.json(
      {
        error:
          "No browser subscribed for push notifications yet. Click 'Enable browser notifications' first.",
      },
      { status: 400 }
    );
  }

  const result = await sendPushToUser(session.user.id, {
    title: "Accountaint test notification",
    body: "If you can read this, desktop push is working.",
    url: "/",
  });

  return NextResponse.json({
    success: result.succeeded > 0,
    sent_to_subscriptions: count,
    ...result,
  });
}
