import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { runAllChecks, summarise } from "@/lib/audit/run";
import { CheckRow } from "@/components/audit/check-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CheckCategory, CheckResult } from "@/lib/audit/types";

export const dynamic = "force-dynamic";

const CATEGORY_ORDER: CheckCategory[] = [
  "Ledger",
  "Multi-tenancy",
  "Encryption",
  "Data integrity",
  "Sync",
  "Knowledge",
  "Email",
];

export default async function AuditPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/onboarding");

  const startedAt = new Date();
  const results = await runAllChecks(session.activeBusiness.id);
  const summary = summarise(results);

  const grouped = new Map<CheckCategory, CheckResult[]>();
  for (const cat of CATEGORY_ORDER) grouped.set(cat, []);
  for (const r of results) {
    if (!grouped.has(r.category)) grouped.set(r.category, []);
    grouped.get(r.category)!.push(r);
  }

  return (
    <div className="space-y-6 max-w-[1100px]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Health</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Internal integrity checks. Different from your business health checklist — this verifies the app itself is working correctly.
        </p>
      </div>

      {/* Summary banner */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">{summary.total}</span>
              <span className="text-sm text-muted-foreground">checks</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{summary.pass}</span>
              <span className="text-sm text-muted-foreground">pass</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">{summary.warn}</span>
              <span className="text-sm text-muted-foreground">warn</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums text-red-600 dark:text-red-400">{summary.fail}</span>
              <span className="text-sm text-muted-foreground">fail</span>
            </div>
            <div className="ml-auto text-xs text-muted-foreground">
              Run took {summary.duration_ms}ms · {startedAt.toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" })}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm">
            <form action="/audit">
              <button type="submit" className="text-primary hover:underline">
                Re-run all checks
              </button>
            </form>
            <Link href="/audit/jobs" className="text-muted-foreground hover:text-foreground">
              View scheduled jobs →
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Grouped checks */}
      {CATEGORY_ORDER.map((cat) => {
        const items = grouped.get(cat) ?? [];
        if (items.length === 0) return null;
        const failCount = items.filter((i) => i.status === "fail").length;
        const warnCount = items.filter((i) => i.status === "warn").length;
        const headerSummary =
          failCount > 0
            ? `${failCount} fail${failCount === 1 ? "" : "s"}`
            : warnCount > 0
              ? `${warnCount} warn${warnCount === 1 ? "" : "s"}`
              : "all pass";
        return (
          <Card key={cat}>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {cat}
              </CardTitle>
              <span className="text-xs text-muted-foreground">{headerSummary}</span>
            </CardHeader>
            <CardContent className="p-0">
              {items.map((r) => (
                <CheckRow key={r.name} result={r} />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
