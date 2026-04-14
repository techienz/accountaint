"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2, RefreshCw, TrendingDown, Shield, AlertTriangle, Zap, CheckCircle2, Clock, Info,
} from "lucide-react";

type Recommendation = {
  id: string;
  strategy: string;
  currentApproach: string;
  optimisedApproach: string;
  annualSaving: number;
  riskLevel: "safe" | "moderate" | "aggressive";
  riskNote: string | null;
  actionType: "auto" | "reminder" | "info";
  actionDetails: string;
  irdReference: string | null;
  applied?: boolean;
};

type Result = {
  id: string;
  tax_year: number;
  recommendations: Recommendation[];
  total_potential_saving: number;
  opportunity_count: number;
  scanned_at: string;
};

const fmt = (n: number) =>
  "$" + Math.abs(n).toLocaleString("en-NZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const riskConfig = {
  safe: { icon: Shield, color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30", label: "Safe" },
  moderate: { icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30", label: "Moderate" },
  aggressive: { icon: Zap, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30", label: "Aggressive" },
};

const actionConfig = {
  auto: { icon: Zap, label: "Auto-apply" },
  reminder: { icon: Clock, label: "Set Reminder" },
  info: { icon: Info, label: "Info" },
};

export default function TaxOptimisationPage() {
  const [result, setResult] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);

  async function loadData() {
    const res = await fetch("/api/tax-optimisation");
    if (res.ok) {
      const data = await res.json();
      if (data.result) setResult(data.result);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleRunAnalysis() {
    setRunning(true);
    await fetch("/api/tax-optimisation", { method: "POST" });

    const poll = setInterval(async () => {
      const res = await fetch("/api/tax-optimisation");
      if (res.ok) {
        const data = await res.json();
        if (data.result && (!result || data.result.id !== result?.id)) {
          setResult(data.result);
          setRunning(false);
          clearInterval(poll);
        }
      }
    }, 5000);

    setTimeout(() => { clearInterval(poll); setRunning(false); loadData(); }, 300000);
  }

  async function handleApply(recId: string) {
    if (!result) return;
    setApplying(recId);
    const res = await fetch("/api/tax-optimisation/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultId: result.id, recommendationId: recId }),
    });
    if (res.ok) {
      setResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          recommendations: prev.recommendations.map((r) =>
            r.id === recId ? { ...r, applied: true } : r
          ),
        };
      });
    }
    setApplying(null);
  }

  const unapplied = result?.recommendations.filter((r) => !r.applied) || [];
  const totalUnappliedSaving = unapplied.reduce((sum, r) => sum + r.annualSaving, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tax Optimisation</h1>
          <p className="text-muted-foreground">
            Find every legal way to reduce your tax burden
          </p>
        </div>
        <Button onClick={handleRunAnalysis} disabled={running}>
          {running ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analysing...</>
          ) : (
            <><RefreshCw className="mr-2 h-4 w-4" />Run Analysis</>
          )}
        </Button>
      </div>

      {running && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Analysing your financial data against NZ tax strategies. This takes 30-60 seconds...
          </AlertDescription>
        </Alert>
      )}

      {result && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingDown className="h-8 w-8 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">{fmt(totalUnappliedSaving)}</p>
                    <p className="text-xs text-muted-foreground">Potential annual savings</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-3xl font-bold">{unapplied.length}</p>
                <p className="text-xs text-muted-foreground">Opportunities found</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Last scanned</p>
                <p className="text-sm font-medium">
                  {new Date(result.scanned_at).toLocaleDateString("en-NZ", {
                    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Tax year {result.tax_year}</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {result.recommendations.map((rec) => {
              const risk = riskConfig[rec.riskLevel];
              const action = actionConfig[rec.actionType];
              const RiskIcon = risk.icon;
              return (
                <Card key={rec.id} className={rec.applied ? "opacity-60" : ""}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{rec.strategy}</h3>
                          <Badge variant="outline" className={`${risk.bg} ${risk.color} border-0`}>
                            <RiskIcon className="h-3 w-3 mr-1" />
                            {risk.label}
                          </Badge>
                          {rec.applied && (
                            <Badge variant="secondary">
                              <CheckCircle2 className="h-3 w-3 mr-1" />Applied
                            </Badge>
                          )}
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs uppercase tracking-wide">Current</p>
                            <p>{rec.currentApproach}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs uppercase tracking-wide">Optimised</p>
                            <p className="font-medium">{rec.optimisedApproach}</p>
                          </div>
                        </div>

                        <p className="text-sm text-muted-foreground">{rec.actionDetails}</p>

                        {rec.riskNote && (
                          <p className="text-xs text-muted-foreground italic">{rec.riskNote}</p>
                        )}
                        {rec.irdReference && (
                          <p className="text-xs text-muted-foreground">Ref: {rec.irdReference}</p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{fmt(rec.annualSaving)}</p>
                        <p className="text-xs text-muted-foreground">per year</p>
                        {!rec.applied && rec.actionType !== "info" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={() => handleApply(rec.id)}
                            disabled={applying === rec.id}
                          >
                            {applying === rec.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>{action.icon === Zap ? <Zap className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}{action.label}</>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {!result && !running && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <TrendingDown className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>No analysis run yet.</p>
            <p className="text-sm mt-1">Click &quot;Run Analysis&quot; to scan your finances for tax saving opportunities.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
