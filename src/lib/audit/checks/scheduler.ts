import { JOB_CATALOG, getLatestRunPerJob } from "@/lib/scheduler/run-job";
import type { Check } from "../types";

/**
 * Heartbeat check: every job in the catalog should have run within
 * (1.5 * expected_interval_seconds). Catches jobs that stopped firing
 * (missed cron windows) AND jobs that ran but errored on the last attempt.
 */
export const schedulerHeartbeatCheck: Check = {
  name: "Scheduler heartbeat",
  category: "Sync",
  async run() {
    const latest = getLatestRunPerJob();
    const now = Date.now();
    const overdue: { id: string; description: string }[] = [];
    const failed: { id: string; description: string }[] = [];
    const neverRan: { id: string; description: string }[] = [];

    for (const [name, def] of Object.entries(JOB_CATALOG)) {
      const last = latest[name];
      if (!last) {
        neverRan.push({ id: name, description: `${def.label} — never run` });
        continue;
      }
      if (last.status === "failure") {
        failed.push({
          id: name,
          description: `${def.label} — last run FAILED at ${last.started_at.toISOString()}`,
        });
      }
      const ageSec = (now - last.started_at.getTime()) / 1000;
      const stalenessLimit = def.expected_interval_seconds * 1.5;
      if (ageSec > stalenessLimit) {
        overdue.push({
          id: name,
          description: `${def.label} — last run ${Math.round(ageSec / 60)} min ago (expected within ${Math.round(def.expected_interval_seconds / 60)} min)`,
        });
      }
    }

    const allIssues = [...overdue, ...failed, ...neverRan];
    const totalJobs = Object.keys(JOB_CATALOG).length;

    if (allIssues.length === 0) {
      return {
        status: "pass",
        message: `All ${totalJobs} scheduled jobs ran within their expected window.`,
      };
    }

    if (failed.length > 0 || overdue.length > 0) {
      return {
        status: "fail",
        message: `${failed.length} failed, ${overdue.length} overdue, ${neverRan.length} never run (of ${totalJobs} jobs).`,
        count: failed.length + overdue.length,
        details: allIssues,
      };
    }
    // Only "never ran" — typical for a fresh install before the first scheduler tick
    return {
      status: "warn",
      message: `${neverRan.length} of ${totalJobs} jobs have never run yet (probably waiting on first cron tick).`,
      count: neverRan.length,
      details: neverRan,
    };
  },
};
