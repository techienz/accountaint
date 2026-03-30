import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !session.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status } = body as { status?: string };

  if (!status || !["reviewed", "dismissed", "asked"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const db = getDb();

  // Verify the anomaly belongs to this business
  const anomaly = db
    .select()
    .from(schema.anomalies)
    .where(
      and(
        eq(schema.anomalies.id, id),
        eq(schema.anomalies.business_id, session.activeBusiness.id)
      )
    )
    .get();

  if (!anomaly) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  db.update(schema.anomalies)
    .set({
      status,
      reviewed_at: new Date(),
    })
    .where(eq(schema.anomalies.id, id))
    .run();

  return NextResponse.json({ success: true });
}
