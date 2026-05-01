import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";

/**
 * Cross-cutting audit trail. Every meaningful state-changing action
 * (regardless of whether it came from UI, chat, API, or scheduler) writes
 * a row. Surfaces on /audit/actions and per-entity history pages.
 *
 * Distinct from chat_actions (which logs every chat tool call regardless of
 * whether it mutated state) and job_runs (which logs scheduler invocations).
 * audit_log captures the WHAT-CHANGED across all sources.
 */
export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  user_id: text("user_id"),                                   // null for scheduler
  source: text("source", { enum: ["ui", "chat", "api", "scheduler"] }).notNull(),
  entity_type: text("entity_type").notNull(),                  // e.g. "invoice", "dividend", "timesheet_entry"
  entity_id: text("entity_id"),                                // can be null for bulk actions
  action: text("action").notNull(),                            // e.g. "created", "updated", "deleted", "sent_email", "declared"
  summary: text("summary"),                                    // short human-readable description
  before_json: text("before_json"),                            // optional snapshot before
  after_json: text("after_json"),                              // optional snapshot after
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
