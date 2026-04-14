"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HealthCheckItem } from "@/lib/help/health-checks";

const statusIcons = {
  good: <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />,
  action_needed: <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />,
};

const statusOrder: Record<string, number> = {
  action_needed: 0,
  warning: 1,
  good: 2,
};

export function HealthChecklistCard({
  items,
  score,
}: {
  items: HealthCheckItem[];
  score: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const sorted = [...items].sort(
    (a, b) => statusOrder[a.status] - statusOrder[b.status]
  );

  const actionCount = items.filter((i) => i.status === "action_needed").length;
  const warningCount = items.filter((i) => i.status === "warning").length;
  const goodCount = items.filter((i) => i.status === "good").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Business Health</CardTitle>
            <div className="flex gap-3 text-xs text-muted-foreground">
              {actionCount > 0 && (
                <span className="text-red-600">
                  {actionCount} action needed
                </span>
              )}
              {warningCount > 0 && (
                <span className="text-amber-600">
                  {warningCount} warning{warningCount > 1 ? "s" : ""}
                </span>
              )}
              <span className="text-emerald-600">{goodCount} good</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-2xl font-bold ${
                score >= 80
                  ? "text-emerald-600"
                  : score >= 50
                    ? "text-amber-600"
                    : "text-red-600"
              }`}
            >
              {score}%
            </span>
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>
        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-muted mt-2">
          <div
            className={`h-full rounded-full transition-all ${
              score >= 80
                ? "bg-emerald-500"
                : score >= 50
                  ? "bg-amber-500"
                  : "bg-red-500"
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          {sorted.map((item) => (
            <div key={item.id} className="flex gap-2">
              {statusIcons[item.status]}
              <div className="min-w-0">
                <div className="text-sm font-medium leading-tight">
                  {item.link ? (
                    <Link href={item.link} className="hover:underline">
                      {item.title}
                    </Link>
                  ) : (
                    item.title
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {item.status === "good"
                    ? item.description
                    : item.action || item.description}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
