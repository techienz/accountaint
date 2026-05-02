import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listChatActions } from "@/lib/ai/audit";

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
  return d.toLocaleString("en-NZ", { timeZone: "Pacific/Auckland", dateStyle: "short", timeStyle: "medium" });
}

export default async function ChatAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ tool?: string; status?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/onboarding");

  const sp = await searchParams;
  const opts: { toolName?: string; success?: boolean } = {};
  if (sp.tool) opts.toolName = sp.tool;
  if (sp.status === "success") opts.success = true;
  else if (sp.status === "failure") opts.success = false;

  const actions = listChatActions(session.activeBusiness.id, 200, opts);

  // Distinct tools for filter dropdown
  const allActions = listChatActions(session.activeBusiness.id, 500);
  const distinctTools = Array.from(new Set(allActions.map((a) => a.tool_name))).sort();

  // Group by conversation_id for visual cohesion
  const byConv = new Map<string, typeof actions>();
  for (const a of actions) {
    const k = a.conversation_id;
    if (!byConv.has(k)) byConv.set(k, []);
    byConv.get(k)!.push(a);
  }

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <Link href="/audit" className="text-xs text-muted-foreground hover:text-foreground">← System integrity</Link>
        <h1 className="text-2xl font-bold tracking-tight mt-1">Chat Action Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every tool call the AI made, grouped by conversation. Browse here to spot hallucinations or unexpected behaviour after the fact.
        </p>
      </div>

      {/* Filter strip */}
      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Tool:</span>
              <select name="tool" defaultValue={sp.tool ?? ""} className="border border-input bg-background rounded px-2 py-1">
                <option value="">All</option>
                {distinctTools.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Status:</span>
              <select name="status" defaultValue={sp.status ?? ""} className="border border-input bg-background rounded px-2 py-1">
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>
            </label>
            <button type="submit" className="text-primary hover:underline">Apply</button>
            {(sp.tool || sp.status) && (
              <Link href="/audit/chat" className="text-muted-foreground hover:text-foreground">Clear</Link>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {actions.length} action{actions.length === 1 ? "" : "s"} · {byConv.size} conversation{byConv.size === 1 ? "" : "s"}
            </span>
          </form>
        </CardContent>
      </Card>

      {actions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No chat actions recorded yet.
          </CardContent>
        </Card>
      ) : (
        Array.from(byConv.entries()).map(([convId, items]) => (
          <Card key={convId}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono text-muted-foreground">
                Conversation {convId.slice(0, 8)} · {items.length} call{items.length === 1 ? "" : "s"} · {ago(items[0].created_at)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-2 w-[170px]">Time</th>
                    <th className="text-left font-medium px-4 py-2 w-[200px]">Tool</th>
                    <th className="text-left font-medium px-4 py-2">Args / Result</th>
                    <th className="text-left font-medium px-4 py-2 w-[80px]">Status</th>
                    <th className="text-right font-medium px-4 py-2 w-[80px]">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {items.slice().reverse().map((a) => (
                    <tr key={a.id} className="border-b border-border/20 last:border-b-0 align-top">
                      <td className="px-4 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatDate(a.created_at)}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{a.tool_name}</td>
                      <td className="px-4 py-2">
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground">
                            {a.error_message
                              ? <span className="text-red-600 dark:text-red-400">{a.error_message.split("\n")[0]}</span>
                              : (a.result_summary?.slice(0, 100) ?? "(empty)")
                            }
                          </summary>
                          <div className="mt-2 space-y-2">
                            <div>
                              <div className="text-muted-foreground mb-1">Args:</div>
                              <pre className="bg-muted/50 p-2 rounded text-[11px] whitespace-pre-wrap break-all">{a.args_json ?? "(none)"}</pre>
                            </div>
                            {a.result_summary && (
                              <div>
                                <div className="text-muted-foreground mb-1">Result:</div>
                                <pre className="bg-muted/50 p-2 rounded text-[11px] whitespace-pre-wrap break-all">{a.result_summary}</pre>
                              </div>
                            )}
                            {a.error_message && (
                              <div>
                                <div className="text-muted-foreground mb-1">Error:</div>
                                <pre className="bg-red-50 dark:bg-red-950/30 p-2 rounded text-[11px] whitespace-pre-wrap break-all text-red-700 dark:text-red-300">{a.error_message}</pre>
                              </div>
                            )}
                          </div>
                        </details>
                      </td>
                      <td className={`px-4 py-2 text-xs ${a.success ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {a.success ? "ok" : "fail"}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-muted-foreground tabular-nums">
                        {a.duration_ms != null ? `${a.duration_ms}ms` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
