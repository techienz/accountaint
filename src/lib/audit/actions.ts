import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, desc, and, gte } from "drizzle-orm";

export type AuditSource = "ui" | "chat" | "api" | "scheduler";

export type RecordActionInput = {
  businessId: string;
  userId?: string | null;
  source: AuditSource;
  entityType: string;
  entityId?: string | null;
  action: string;             // "created", "updated", "deleted", "sent_email", "declared", etc.
  summary?: string;
  before?: unknown;
  after?: unknown;
};

/**
 * Record an action in the cross-cutting audit_log. Never throws — if
 * logging fails, the underlying action is unaffected.
 */
export function recordAction(input: RecordActionInput): void {
  try {
    const db = getDb();
    db.insert(schema.auditLog).values({
      id: uuid(),
      business_id: input.businessId,
      user_id: input.userId ?? null,
      source: input.source,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      action: input.action,
      summary: input.summary ?? null,
      before_json: input.before !== undefined ? safeStringify(input.before) : null,
      after_json: input.after !== undefined ? safeStringify(input.after) : null,
    }).run();
  } catch (err) {
    console.error("[audit] Failed to record action:", err);
  }
}

function safeStringify(v: unknown): string | null {
  try {
    const s = JSON.stringify(v);
    return s.length > 4000 ? s.slice(0, 4000) + "…" : s;
  } catch {
    return null;
  }
}

export type ListActionsFilter = {
  source?: AuditSource;
  entityType?: string;
  entityId?: string;
  since?: Date;
};

export function listAuditActions(businessId: string, limit = 200, filter?: ListActionsFilter) {
  const db = getDb();
  const conditions = [eq(schema.auditLog.business_id, businessId)];
  if (filter?.since) {
    conditions.push(gte(schema.auditLog.created_at, filter.since));
  }
  if (filter?.entityId) {
    conditions.push(eq(schema.auditLog.entity_id, filter.entityId));
  }
  let rows = db
    .select()
    .from(schema.auditLog)
    .where(and(...conditions))
    .orderBy(desc(schema.auditLog.created_at))
    .limit(500)
    .all();
  if (filter?.source) rows = rows.filter((r) => r.source === filter.source);
  if (filter?.entityType) rows = rows.filter((r) => r.entity_type === filter.entityType);
  return rows.slice(0, limit);
}
