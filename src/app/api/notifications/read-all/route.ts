import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function POST() {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  db.update(schema.notificationItems)
    .set({ read: true })
    .where(
      and(
        eq(schema.notificationItems.business_id, session.activeBusiness.id),
        eq(schema.notificationItems.read, false)
      )
    )
    .run();

  return NextResponse.json({ success: true });
}
