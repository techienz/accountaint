import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JOB_CATALOG, getLatestRunPerJob, listRecentJobRuns } from "@/lib/scheduler/run-job";

export const dynamic = "force-dynamic";

function ago(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

function formatDate(d: Date): string {
  return d.toLocaleString("en-NZ", { timeZone: "Pacific/Auckland", dateStyle: "short", timeStyle: "short" });
}

const STATUS_COLOR: Record<string, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  running: "text-amber-600 dark:text-amber-400",
  failure: "text-red-600 dark:text-red-400",
};

export default async function JobsAuditPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const latest = getLatestRunPerJob();
  const recent = listRecentJobRuns(100);

  return (
    <div className="space-y-6 max-w-[1100px]">
      <div>
        <Link href="/audit" className="text-xs text-muted-foreground hover:text-foreground">← System integrity</Link>
        <h1 className="text-2xl font-bold tracking-tight mt-1">Scheduled Jobs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Status of every scheduled job + the last 100 runs across all jobs.
        </p>
      </div>

      {/* Per-job latest status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Last run per job
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-2">Job</th>
                <th className="text-left font-medium px-4 py-2">Last run</th>
                <th className="text-left font-medium px-4 py-2">Status</th>
                <th className="text-right font-medium px-4 py-2">Duration</th>
                <th className="text-left font-medium px-4 py-2">Expected interval</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(JOB_CATALOG).map(([name, def]) => {
                const last = latest[name];
                return (
                  <tr key={name} className="border-b border-border/20 last:border-b-0">
                    <td className="px-4 py-2">
                      <div className="font-medium">{def.label}</div>
                      <div className="text-xs text-muted-foreground font-mono">{name}</div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {last ? `${ago(last.started_at)} (${formatDate(last.started_at)})` : <em>never</em>}
                    </td>
                    <td className={`px-4 py-2 ${last ? STATUS_COLOR[last.status] ?? "" : "text-muted-foreground"}`}>
                      {last?.status ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">
                      {last?.duration_ms != null ? `${last.duration_ms}ms` : "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {def.expected_interval_seconds < 86400
                        ? `${Math.round(def.expected_interval_seconds / 3600)}h`
                        : `${Math.round(def.expected_interval_seconds / 86400)}d`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Recent runs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent runs ({recent.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              No job runs recorded yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Started</th>
                  <th className="text-left font-medium px-4 py-2">Job</th>
                  <th className="text-left font-medium px-4 py-2">Status</th>
                  <th className="text-right font-medium px-4 py-2">Duration</th>
                  <th className="text-left font-medium px-4 py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-b border-border/20 last:border-b-0">
                    <td className="px-4 py-2 text-muted-foreground tabular-nums whitespace-nowrap">{formatDate(r.started_at)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.job_name}</td>
                    <td className={`px-4 py-2 ${STATUS_COLOR[r.status] ?? ""}`}>{r.status}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">
                      {r.duration_ms != null ? `${r.duration_ms}ms` : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-red-600 dark:text-red-400 max-w-[400px] truncate" title={r.error_message ?? ""}>
                      {r.error_message?.split("\n")[0] ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
