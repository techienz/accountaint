import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

/**
 * Definition of every scheduled job, keyed by stable job_name. The
 * expected_interval_seconds is what the System Health "scheduler heartbeat"
 * check uses to decide whether a job is overdue.
 *
 * Keep this list in sync with the cron schedules in src/lib/scheduler/index.ts.
 */
export const JOB_CATALOG: Record<string, { label: string; expected_interval_seconds: number }> = {
  xero_sync:                       { label: "Xero data sync",                expected_interval_seconds: 60 * 60 },        // hourly
  deadline_check:                  { label: "Tax deadline check",            expected_interval_seconds: 60 * 60 },        // hourly
  contract_renewal_check:          { label: "Contract renewal check",        expected_interval_seconds: 24 * 60 * 60 },   // daily
  work_contract_expiry_check:      { label: "Work contract expiry check",    expected_interval_seconds: 24 * 60 * 60 },   // daily
  overdue_invoice_check:           { label: "Overdue invoice check",         expected_interval_seconds: 24 * 60 * 60 },   // daily
  upcoming_bills_check:            { label: "Upcoming bills check",          expected_interval_seconds: 24 * 60 * 60 },   // daily
  akahu_sync:                      { label: "Akahu bank sync",               expected_interval_seconds: 4 * 60 * 60 },    // 4-hourly
  knowledge_freshness_check:       { label: "Knowledge base freshness",      expected_interval_seconds: 7 * 24 * 60 * 60 }, // weekly
  chat_attachment_cleanup:         { label: "Chat attachment cleanup",       expected_interval_seconds: 24 * 60 * 60 },   // daily
  regulatory_check:                { label: "Regulatory rules check",        expected_interval_seconds: 31 * 24 * 60 * 60 }, // monthly
  tax_optimisation_scan:           { label: "Tax optimisation scan",         expected_interval_seconds: 31 * 24 * 60 * 60 }, // monthly
  pre_balance_tax_optimisation:    { label: "Pre-balance tax optimisation",  expected_interval_seconds: 7 * 24 * 60 * 60 }, // weekly
  weekly_system_health:            { label: "Weekly System Health check",    expected_interval_seconds: 7 * 24 * 60 * 60 }, // weekly
};

/**
 * Wrap a scheduled-job handler so each invocation writes start + finish rows
 * to job_runs. Errors are recorded and re-thrown so the runtime sees them too.
 *
 * Usage:
 *   cron.schedule("0 * * * *", () => runJob("xero_sync", () => syncAllXeroData()));
 */
export async function runJob<T>(jobName: string, fn: () => Promise<T>): Promise<T> {
  const db = getDb();
  const id = uuid();
  const startedAt = new Date();

  try {
    db.insert(schema.jobRuns).values({
      id,
      job_name: jobName,
      started_at: startedAt,
      status: "running",
    }).run();
  } catch (err) {
    // If the table doesn't exist yet (migration hasn't run), don't block the job.
    console.error(`[scheduler] Could not record job_runs start for ${jobName}:`, err);
    return fn();
  }

  try {
    const result = await fn();
    const finishedAt = new Date();
    db.update(schema.jobRuns)
      .set({
        finished_at: finishedAt,
        status: "success",
        duration_ms: finishedAt.getTime() - startedAt.getTime(),
      })
      .where(eq(schema.jobRuns.id, id))
      .run();
    return result;
  } catch (err) {
    const finishedAt = new Date();
    const errorMessage = err instanceof Error ? `${err.message}\n${err.stack ?? ""}`.slice(0, 4000) : String(err).slice(0, 4000);
    try {
      db.update(schema.jobRuns)
        .set({
          finished_at: finishedAt,
          status: "failure",
          duration_ms: finishedAt.getTime() - startedAt.getTime(),
          error_message: errorMessage,
        })
        .where(eq(schema.jobRuns.id, id))
        .run();
    } catch {
      // swallow — the original error matters more
    }
    throw err;
  }
}

/**
 * Latest run per job, used by the System Health scheduler check and the
 * /audit/jobs page header.
 */
export function getLatestRunPerJob(): Record<string, { started_at: Date; finished_at: Date | null; status: string; duration_ms: number | null }> {
  const db = getDb();
  const out: Record<string, ReturnType<typeof shape>> = {};

  function shape(r: typeof schema.jobRuns.$inferSelect) {
    return {
      started_at: r.started_at,
      finished_at: r.finished_at,
      status: r.status,
      duration_ms: r.duration_ms,
    };
  }

  for (const name of Object.keys(JOB_CATALOG)) {
    const latest = db
      .select()
      .from(schema.jobRuns)
      .where(eq(schema.jobRuns.job_name, name))
      .orderBy(desc(schema.jobRuns.started_at))
      .limit(1)
      .get();
    if (latest) out[name] = shape(latest);
  }
  return out;
}

export function listRecentJobRuns(limit = 100, jobName?: string, status?: string) {
  const db = getDb();
  const all = db
    .select()
    .from(schema.jobRuns)
    .orderBy(desc(schema.jobRuns.started_at))
    .limit(500)
    .all();
  let filtered = all;
  if (jobName) filtered = filtered.filter((r) => r.job_name === jobName);
  if (status) filtered = filtered.filter((r) => r.status === status);
  return filtered.slice(0, limit);
}
