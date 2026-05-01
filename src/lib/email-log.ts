import { v4 as uuid } from "uuid";
import { eq, and, desc, gte } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export type EmailLogKind =
  | "invoice"
  | "invoice_reminder"
  | "timesheet"
  | "payslip"
  | "notification"
  | "other";

export type EmailLogInput = {
  businessId: string;
  kind: EmailLogKind;
  provider?: "smtp" | "graph" | "unknown";
  fromAddress?: string | null;
  toAddress: string;
  ccAddresses?: string[] | null;
  subject: string;
  attachmentNames?: string[] | null;
  success: boolean;
  errorMessage?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
};

/**
 * Record an email send attempt. Never throws — logging failures must not
 * break the caller.
 */
export function recordEmail(input: EmailLogInput): void {
  try {
    const db = getDb();
    db.insert(schema.emailLog)
      .values({
        id: uuid(),
        business_id: input.businessId,
        kind: input.kind,
        provider: input.provider ?? "unknown",
        from_address: input.fromAddress ?? null,
        to_address: input.toAddress,
        cc_addresses:
          input.ccAddresses && input.ccAddresses.length > 0
            ? JSON.stringify(input.ccAddresses)
            : null,
        subject: input.subject,
        attachment_names:
          input.attachmentNames && input.attachmentNames.length > 0
            ? JSON.stringify(input.attachmentNames)
            : null,
        success: input.success,
        error_message: input.errorMessage ?? null,
        related_entity_type: input.relatedEntityType ?? null,
        related_entity_id: input.relatedEntityId ?? null,
      })
      .run();
  } catch (err) {
    console.error(
      "[email-log] Failed to write log row:",
      err instanceof Error ? err.message : err
    );
  }
}

export type EmailLogEntry = {
  id: string;
  sent_at: Date;
  kind: string;
  provider: string;
  from_address: string | null;
  to_address: string;
  cc_addresses: string[] | null;
  subject: string;
  attachment_names: string[] | null;
  success: boolean;
  error_message: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
};

function rowToEntry(row: typeof schema.emailLog.$inferSelect): EmailLogEntry {
  return {
    ...row,
    cc_addresses: row.cc_addresses ? (JSON.parse(row.cc_addresses) as string[]) : null,
    attachment_names: row.attachment_names
      ? (JSON.parse(row.attachment_names) as string[])
      : null,
  };
}

export function listEmailLog(
  businessId: string,
  options?: {
    kind?: EmailLogKind;
    relatedEntityType?: string;
    relatedEntityId?: string;
    sinceDays?: number;
    limit?: number;
  }
): EmailLogEntry[] {
  const db = getDb();
  const conditions = [eq(schema.emailLog.business_id, businessId)];

  if (options?.kind) {
    conditions.push(eq(schema.emailLog.kind, options.kind));
  }
  if (options?.relatedEntityType) {
    conditions.push(
      eq(schema.emailLog.related_entity_type, options.relatedEntityType)
    );
  }
  if (options?.relatedEntityId) {
    conditions.push(
      eq(schema.emailLog.related_entity_id, options.relatedEntityId)
    );
  }
  if (options?.sinceDays) {
    const cutoff = new Date(Date.now() - options.sinceDays * 86_400_000);
    conditions.push(gte(schema.emailLog.sent_at, cutoff));
  }

  const rows = db
    .select()
    .from(schema.emailLog)
    .where(conditions.length > 1 ? and(...conditions) : conditions[0])
    .orderBy(desc(schema.emailLog.sent_at))
    .limit(options?.limit ?? 200)
    .all();

  return rows.map(rowToEntry);
}
