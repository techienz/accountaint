import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { syncAllData } from "@/lib/xero/sync";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.activeBusiness) {
    return NextResponse.json({ error: "No active business selected" }, { status: 400 });
  }

  const businessId = session.activeBusiness.id;
  const db = getDb();
  const connection = db
    .select()
    .from(schema.xeroConnections)
    .where(eq(schema.xeroConnections.business_id, businessId))
    .get();

  if (!connection) {
    return NextResponse.json({ error: "No Xero connection found. Please connect Xero first." }, { status: 400 });
  }

  const results = await syncAllData(businessId);
  return NextResponse.json({ success: results.every((r) => r.success), results });
}
