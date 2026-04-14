"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Wrench,
} from "lucide-react";

type CheckRun = {
  id: string;
  tax_year: number;
  status: string;
  areas_checked: number;
  areas_changed: number;
  areas_uncertain: number;
  started_at: string;
  completed_at: string | null;
};

type CheckResult = {
  id: string;
  area: string;
  current_value: string;
  verified_value: string | null;
  status: string;
  source_url: string | null;
  notes: string | null;
  applied: boolean;
};

type AreaInfo = { id: string; label: string };

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  current: { icon: CheckCircle2, color: "text-green-600 dark:text-green-400", label: "Current" },
  changed: { icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", label: "Changed" },
  uncertain: { icon: HelpCircle, color: "text-red-600 dark:text-red-400", label: "Uncertain" },
  error: { icon: XCircle, color: "text-red-600 dark:text-red-400", label: "Error" },
};

export default function RegulatoryUpdatesPage() {
  const [run, setRun] = useState<CheckRun | null>(null);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [areas, setAreas] = useState<AreaInfo[]>([]);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [hasApplied, setHasApplied] = useState(false);

  async function loadData() {
    const res = await fetch("/api/regulatory/check");
    if (res.ok) {
      const data = await res.json();
      setRun(data.run);
      setResults(data.results || []);
      setAreas(data.areas || []);
      setHasApplied(data.results?.some((r: CheckResult) => r.applied) || false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleRunCheck() {
    setRunning(true);
    await fetch("/api/regulatory/check", { method: "POST" });

    // Poll for completion every 5 seconds
    const poll = setInterval(async () => {
      const res = await fetch("/api/regulatory/check");
      if (res.ok) {
        const data = await res.json();
        if (data.run && data.run.status === "completed") {
          setRun(data.run);
          setResults(data.results || []);
          setAreas(data.areas || []);
          setHasApplied(data.results?.some((r: CheckResult) => r.applied) || false);
          setRunning(false);
          clearInterval(poll);
        } else if (data.run && data.run.status === "failed") {
          setRunning(false);
          clearInterval(poll);
        }
      }
    }, 5000);

    // Safety timeout after 5 minutes
    setTimeout(() => {
      clearInterval(poll);
      setRunning(false);
      loadData();
    }, 300000);
  }

  async function handleApply(checkId: string) {
    setApplying(checkId);
    try {
      const res = await fetch("/api/regulatory/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkId }),
      });
      if (res.ok) {
        setResults((prev) =>
          prev.map((r) => (r.id === checkId ? { ...r, applied: true } : r))
        );
        setHasApplied(true);
      }
    } finally {
      setApplying(null);
    }
  }

  function getAreaLabel(areaId: string): string {
    return areas.find((a) => a.id === areaId)?.label || areaId;
  }

  const currentCount = results.filter((r) => r.status === "current").length;
  const changedCount = results.filter((r) => r.status === "changed" && !r.applied).length;
  const uncertainCount = results.filter((r) => r.status === "uncertain").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Regulatory Updates</h1>
          <p className="text-muted-foreground">
            Keep tax rules and IRD knowledge current
          </p>
        </div>
        <Button onClick={handleRunCheck} disabled={running}>
          {running ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Checking...</>
          ) : (
            <><RefreshCw className="mr-2 h-4 w-4" />Run Check Now</>
          )}
        </Button>
      </div>

      {hasApplied && (
        <Alert>
          <Wrench className="h-4 w-4" />
          <AlertDescription>
            Tax rules updated. Run <code className="bg-muted px-1 rounded">npm run build</code> and restart to apply changes.
          </AlertDescription>
        </Alert>
      )}

      {run && (
        <>
          <div className="text-sm text-muted-foreground">
            Last checked: {new Date(run.started_at).toLocaleDateString("en-NZ")} (tax year {run.tax_year})
            {run.status === "running" && " — in progress..."}
          </div>

          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-2xl font-bold">{currentCount}</p>
                    <p className="text-xs text-muted-foreground">Verified current</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="text-2xl font-bold">{changedCount}</p>
                    <p className="text-xs text-muted-foreground">Needs review</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="text-2xl font-bold">{uncertainCount}</p>
                    <p className="text-xs text-muted-foreground">Uncertain</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Regulatory Areas</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Area</TableHead>
                    <TableHead>Current Value</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result) => {
                    const config = statusConfig[result.status] || statusConfig.error;
                    const Icon = config.icon;
                    return (
                      <TableRow
                        key={result.id}
                        className={
                          result.status === "changed" && !result.applied
                            ? "bg-amber-50 dark:bg-amber-950/20"
                            : result.status === "uncertain"
                            ? "bg-red-50 dark:bg-red-950/20"
                            : ""
                        }
                      >
                        <TableCell className="font-medium">
                          {getAreaLabel(result.area)}
                        </TableCell>
                        <TableCell className="text-sm max-w-48 truncate">
                          {(() => {
                            try {
                              const v = JSON.parse(result.current_value);
                              return typeof v === "object" ? JSON.stringify(v).slice(0, 60) + "..." : String(v);
                            } catch {
                              return result.current_value;
                            }
                          })()}
                        </TableCell>
                        <TableCell className="text-sm max-w-48 truncate">
                          {result.verified_value || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Icon className={`h-4 w-4 ${config.color}`} />
                            <span className={`text-sm ${config.color}`}>
                              {result.applied ? "Applied" : config.label}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {result.source_url && (
                            <a
                              href={result.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Source
                            </a>
                          )}
                        </TableCell>
                        <TableCell>
                          {result.status === "changed" && !result.applied && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApply(result.id)}
                              disabled={applying === result.id}
                            >
                              {applying === result.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Apply"
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {results.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No checks run yet. Click "Run Check Now" to verify your tax rules.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {results.some((r) => r.notes) && (
                <div className="mt-4 space-y-2">
                  {results
                    .filter((r) => r.notes && r.status !== "current")
                    .map((r) => (
                      <div key={r.id} className="text-xs text-muted-foreground">
                        <span className="font-medium">{getAreaLabel(r.area)}:</span> {r.notes}
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!run && !running && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <RefreshCw className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>No regulatory checks have been run yet.</p>
            <p className="text-sm mt-1">
              Click "Run Check Now" to verify all tax rules against current IRD sources.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
