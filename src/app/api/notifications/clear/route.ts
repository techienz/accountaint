import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function POST() {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  db.delete(schema.notificationItems)
    .where(eq(schema.notificationItems.business_id, session.activeBusiness.id))
    .run();

  return NextResponse.json({ success: true });
}
