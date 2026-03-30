import { v4 as uuid } from "uuid";
import { eq, and, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { diffSnapshots } from "./diff";
import { analyseChanges } from "./anomalies";
import type { XeroEntityType } from "@/lib/xero/types";

const ENTITY_TYPES: XeroEntityType[] = [
  "profit_loss",
  "balance_sheet",
  "bank_accounts",
  "invoices",
  "contacts",
];

/**
 * Detect changes between the two most recent snapshots for each entity type.
 * Stores results in change_reports and anomalies tables.
 * Returns IDs of change reports created.
 */
export async function detectChanges(
  businessId: string,
  entityType?: XeroEntityType
): Promise<string[]> {
  const db = getDb();
  const types = entityType ? [entityType] : ENTITY_TYPES;
  const reportIds: string[] = [];

  for (const type of types) {
    // Get the two most recent snapshots
    const snapshots = db
      .select()
      .from(schema.xeroSnapshots)
      .where(
        and(
          eq(schema.xeroSnapshots.business_id, businessId),
          eq(schema.xeroSnapshots.entity_type, type)
        )
      )
      .orderBy(desc(schema.xeroSnapshots.synced_at))
      .limit(2)
      .all();

    if (snapshots.length < 2) continue;

    const [toSnapshot, fromSnapshot] = snapshots;
    if (fromSnapshot.data_hash === toSnapshot.data_hash) continue;

    const fromData = JSON.parse(fromSnapshot.data);
    const toData = JSON.parse(toSnapshot.data);

    const changes = diffSnapshots(type, fromData, toData);
    if (changes.length === 0) continue;

    const reportId = uuid();
    db.insert(schema.changeReports)
      .values({
        id: reportId,
        business_id: businessId,
        entity_type: type,
        from_snapshot_id: fromSnapshot.id,
        to_snapshot_id: toSnapshot.id,
        changes_json: JSON.stringify(changes),
        change_count: changes.length,
      })
      .run();

    // Run anomaly detection
    const detectedAnomalies = analyseChanges(
      changes,
      type,
      fromData,
      toData,
      businessId
    );

    for (const anomaly of detectedAnomalies) {
      db.insert(schema.anomalies)
        .values({
          id: uuid(),
          business_id: businessId,
          change_report_id: reportId,
          severity: anomaly.severity,
          category: anomaly.category,
          title: anomaly.title,
          description: anomaly.description,
          entity_type: type,
          entity_id: anomaly.entity_id,
          suggested_question: anomaly.suggested_question,
          status: "new",
        })
        .run();
    }

    reportIds.push(reportId);
  }

  return reportIds;
}
