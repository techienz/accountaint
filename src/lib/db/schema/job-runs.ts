import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Audit log of every scheduled job execution. One row written when the job
 * starts, updated when it finishes (or errors). Surfaces on /audit/jobs and
 * feeds the scheduler heartbeat check on /audit.
 */
export const jobRuns = sqliteTable("job_runs", {
  id: text("id").primaryKey(),
  job_name: text("job_name").notNull(),
  started_at: integer("started_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  finished_at: integer("finished_at", { mode: "timestamp" }),
  status: text("status", { enum: ["running", "success", "failure"] })
    .notNull()
    .default("running"),
  error_message: text("error_message"),
  duration_ms: integer("duration_ms"),
});
