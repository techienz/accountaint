import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.activeBusiness) {
    return NextResponse.json(
      { error: "No active business selected" },
      { status: 400 }
    );
  }

  const db = getDb();
  const businessId = session.activeBusiness.id;

  // Delete xero connection
  db.delete(schema.xeroConnections)
    .where(eq(schema.xeroConnections.business_id, businessId))
    .run();

  // Delete cached data
  db.delete(schema.xeroCache)
    .where(eq(schema.xeroCache.business_id, businessId))
    .run();

  return NextResponse.json({ success: true });
}
