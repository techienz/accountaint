import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listAuditActions } from "@/lib/audit/actions";

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return d.toLocaleString("en-NZ", { timeZone: "Pacific/Auckland", dateStyle: "short", timeStyle: "medium" });
}

const SOURCE_COLOR: Record<string, string> = {
  ui: "text-blue-600 dark:text-blue-400",
  chat: "text-purple-600 dark:text-purple-400",
  api: "text-amber-600 dark:text-amber-400",
  scheduler: "text-emerald-600 dark:text-emerald-400",
};

export default async function ActionsAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; entity?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/onboarding");

  const sp = await searchParams;
  const filter: { source?: "ui" | "chat" | "api" | "scheduler"; entityType?: string } = {};
  if (sp.source && ["ui", "chat", "api", "scheduler"].includes(sp.source)) {
    filter.source = sp.source as "ui" | "chat" | "api" | "scheduler";
  }
  if (sp.entity) filter.entityType = sp.entity;

  const actions = listAuditActions(session.activeBusiness.id, 200, filter);
  const allActions = listAuditActions(session.activeBusiness.id, 500);
  const distinctEntities = Array.from(new Set(allActions.map((a) => a.entity_type))).sort();

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <Link href="/audit" className="text-xs text-muted-foreground hover:text-foreground">← System integrity</Link>
        <h1 className="text-2xl font-bold tracking-tight mt-1">Action Audit Trail</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cross-cutting log of state-changing actions — UI, chat, API, scheduler. Use to answer &ldquo;who did what when&rdquo;.
        </p>
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          ⚠ v1: only the highest-stakes chat tools (declare_dividend, delete_timesheet_entries) currently write to this log. Coverage will expand.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Source:</span>
              <select name="source" defaultValue={sp.source ?? ""} className="border border-input bg-background rounded px-2 py-1">
                <option value="">All</option>
                <option value="ui">UI</option>
                <option value="chat">Chat</option>
                <option value="api">API</option>
                <option value="scheduler">Scheduler</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Entity type:</span>
              <select name="entity" defaultValue={sp.entity ?? ""} className="border border-input bg-background rounded px-2 py-1">
                <option value="">All</option>
                {distinctEntities.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <button type="submit" className="text-primary hover:underline">Apply</button>
            {(sp.source || sp.entity) && (
              <Link href="/audit/actions" className="text-muted-foreground hover:text-foreground">Clear</Link>
            )}
            <span className="ml-auto text-xs text-muted-foreground">{actions.length} action{actions.length === 1 ? "" : "s"}</span>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {actions.length === 0 ? (
            <p className="px-4 py-10 text-sm text-muted-foreground text-center">
              No audit actions recorded yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2 w-[160px]">When</th>
                  <th className="text-left font-medium px-4 py-2 w-[80px]">Source</th>
                  <th className="text-left font-medium px-4 py-2 w-[160px]">Entity</th>
                  <th className="text-left font-medium px-4 py-2 w-[120px]">Action</th>
                  <th className="text-left font-medium px-4 py-2">Summary / Detail</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.id} className="border-b border-border/20 last:border-b-0 align-top">
                    <td className="px-4 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">{formatDate(a.created_at)}</td>
                    <td className={`px-4 py-2 font-mono text-xs ${SOURCE_COLOR[a.source] ?? ""}`}>{a.source}</td>
                    <td className="px-4 py-2 font-mono text-xs">{a.entity_type}{a.entity_id ? <span className="text-muted-foreground"> ({a.entity_id.slice(0, 8)})</span> : null}</td>
                    <td className="px-4 py-2 font-medium">{a.action}</td>
                    <td className="px-4 py-2">
                      <details className="text-xs">
                        <summary className="cursor-pointer">{a.summary ?? <em className="text-muted-foreground">no summary</em>}</summary>
                        {(a.before_json || a.after_json) && (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {a.before_json && <div><div className="text-muted-foreground mb-1">Before:</div><pre className="bg-muted/50 p-2 rounded text-[11px] whitespace-pre-wrap break-all">{a.before_json}</pre></div>}
                            {a.after_json && <div><div className="text-muted-foreground mb-1">After:</div><pre className="bg-muted/50 p-2 rounded text-[11px] whitespace-pre-wrap break-all">{a.after_json}</pre></div>}
                          </div>
                        )}
                      </details>
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
