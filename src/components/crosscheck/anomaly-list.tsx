"use client";

import { useState } from "react";

type Anomaly = {
  id: string;
  severity: string;
  category: string;
  title: string;
  description: string;
  entity_type: string;
  suggested_question: string | null;
  status: string;
  created_at: Date;
};

const severityStyles: Record<string, string> = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function AnomalyList({ anomalies: initial }: { anomalies: Anomaly[] }) {
  const [anomalies, setAnomalies] = useState(initial);
  const [updating, setUpdating] = useState<string | null>(null);

  const active = anomalies.filter((a) => a.status === "new");
  const dismissed = anomalies.filter((a) => a.status !== "new");

  async function updateStatus(id: string, status: string) {
    setUpdating(id);
    try {
      const res = await fetch(`/api/crosscheck/anomalies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setAnomalies((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status } : a))
        );
      }
    } finally {
      setUpdating(null);
    }
  }

  if (anomalies.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No anomalies flagged. Everything looks normal.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {active.length > 0 && (
        <div className="space-y-3">
          {active.map((anomaly) => (
            <div key={anomaly.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${severityStyles[anomaly.severity] || ""}`}
                    >
                      {anomaly.severity}
                    </span>
                    <span className="text-sm font-medium">{anomaly.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {anomaly.description}
                  </p>
                  {anomaly.suggested_question && (
                    <p className="mt-2 text-sm italic text-muted-foreground border-l-2 border-primary/30 pl-3">
                      {anomaly.suggested_question}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => updateStatus(anomaly.id, "reviewed")}
                    disabled={updating === anomaly.id}
                    className="rounded px-2 py-1 text-xs border hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    Reviewed
                  </button>
                  <button
                    onClick={() => updateStatus(anomaly.id, "dismissed")}
                    disabled={updating === anomaly.id}
                    className="rounded px-2 py-1 text-xs border hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {dismissed.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            {dismissed.length} reviewed/dismissed {dismissed.length === 1 ? "item" : "items"}
          </summary>
          <div className="mt-2 space-y-2 opacity-60">
            {dismissed.map((anomaly) => (
              <div key={anomaly.id} className="rounded border p-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${severityStyles[anomaly.severity] || ""}`}
                  >
                    {anomaly.severity}
                  </span>
                  <span className="text-sm">{anomaly.title}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {anomaly.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
