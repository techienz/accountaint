import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, and, desc, gte } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !session.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = session.activeBusiness.id;
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entity_type");
  const daysBack = parseInt(searchParams.get("days_back") || "30", 10);

  const db = getDb();
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  // Get change reports
  let reportsQuery = db
    .select()
    .from(schema.changeReports)
    .where(
      and(
        eq(schema.changeReports.business_id, businessId),
        gte(schema.changeReports.created_at, since),
        ...(entityType ? [eq(schema.changeReports.entity_type, entityType)] : [])
      )
    )
    .orderBy(desc(schema.changeReports.created_at))
    .limit(50);

  const reports = reportsQuery.all();

  // Get anomalies
  let anomaliesQuery = db
    .select()
    .from(schema.anomalies)
    .where(
      and(
        eq(schema.anomalies.business_id, businessId),
        gte(schema.anomalies.created_at, since),
        ...(entityType ? [eq(schema.anomalies.entity_type, entityType)] : [])
      )
    )
    .orderBy(desc(schema.anomalies.created_at))
    .limit(100);

  const anomaliesList = anomaliesQuery.all();

  return NextResponse.json({
    reports: reports.map((r) => ({
      ...r,
      changes: JSON.parse(r.changes_json),
    })),
    anomalies: anomaliesList,
  });
}
