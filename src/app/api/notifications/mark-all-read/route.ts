import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getBusiness } from "@/lib/business";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { businessId } = body;

  if (!businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
  }

  const biz = getBusiness(session.user.id, businessId);
  if (!biz) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = getDb();
  db.update(schema.notificationItems)
    .set({ read: true })
    .where(eq(schema.notificationItems.business_id, businessId))
    .run();

  return NextResponse.json({ success: true });
}
