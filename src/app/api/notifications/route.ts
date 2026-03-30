import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getNotifications, getUnreadCount } from "@/lib/notifications/in-app";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.activeBusiness) {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }

  const businessId = session.activeBusiness.id;
  const notifications = getNotifications(businessId);
  const unreadCount = getUnreadCount(businessId);

  return NextResponse.json({ notifications, unreadCount });
}
