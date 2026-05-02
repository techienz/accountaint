import { getDb, schema } from "@/lib/db";
import { runAllChecks, summarise } from "./run";
import { notify } from "@/lib/notifications";

/**
 * Weekly auto-run of System Health checks for every business. On any
 * `fail` the business owner gets a notification through their configured
 * channels (uses the existing notify() pipeline → email/desktop/slack).
 *
 * Wired into the scheduler in src/lib/scheduler/index.ts as
 * "weekly_system_health".
 */
export async function runScheduledHealthChecks(): Promise<void> {
  const db = getDb();
  const businesses = db.select().from(schema.businesses).all();

  for (const biz of businesses) {
    try {
      const results = await runAllChecks(biz.id);
      const summary = summarise(results);
      const failures = results.filter((r) => r.status === "fail");

      console.log(
        `[health] ${biz.name}: ${summary.pass} pass / ${summary.warn} warn / ${summary.fail} fail (${summary.duration_ms}ms)`
      );

      if (failures.length > 0) {
        const failureLines = failures
          .map((f) => `• [${f.category}] ${f.name}: ${f.message}`)
          .join("\n");

        await notify({
          businessId: biz.id,
          userId: biz.owner_user_id,
          businessName: biz.name,
          title: `System integrity: ${failures.length} failure${failures.length === 1 ? "" : "s"}`,
          body: `${failureLines}\n\nVisit /audit on Accountaint to investigate.`,
          vagueTitle: "System integrity alert",
          vagueBody: "An app integrity check failed — review on /audit.",
          type: "alert",
        });
      }
    } catch (err) {
      console.error(`[health] System Health run failed for business ${biz.id}:`, err);
    }
  }
}
