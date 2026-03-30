"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

type KnowledgeStatus = {
  chunkCount: number;
  guideCount: number;
  guides: string[];
  lastFetched: string | null;
  freshnessState: "fresh" | "aging" | "stale";
  daysSinceUpdate: number | null;
};

export function KnowledgeStatusCard() {
  const [status, setStatus] = useState<KnowledgeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetch("/api/knowledge/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  async function handleUpdate() {
    setUpdating(true);
    try {
      await fetch("/api/knowledge/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "all" }),
      });
      // Refresh status
      const res = await fetch("/api/knowledge/status");
      setStatus(await res.json());
    } catch {
      // Silently fail — user can retry
    } finally {
      setUpdating(false);
    }
  }

  const freshnessColor = {
    fresh: "text-green-600",
    aging: "text-amber-600",
    stale: "text-red-600",
  };

  const freshnessLabel = {
    fresh: "Up to date",
    aging: "Getting stale",
    stale: "Needs update",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Knowledge Base</CardTitle>
        <BookOpen className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !status ? (
          <p className="text-sm text-muted-foreground">Unable to load status</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{status.guideCount}</span>
              <span className="text-sm text-muted-foreground">guides</span>
              <span className="text-sm text-muted-foreground">·</span>
              <span className="text-sm text-muted-foreground">
                {status.chunkCount} chunks
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span
                className={`font-medium ${freshnessColor[status.freshnessState]}`}
              >
                {freshnessLabel[status.freshnessState]}
              </span>
              {status.daysSinceUpdate !== null && (
                <span className="text-muted-foreground">
                  · Updated{" "}
                  {status.daysSinceUpdate === 0
                    ? "today"
                    : `${status.daysSinceUpdate}d ago`}
                </span>
              )}
            </div>

            {status.freshnessState !== "fresh" && (
              <button
                onClick={handleUpdate}
                disabled={updating}
                className="mt-1 text-sm font-medium text-primary hover:underline disabled:opacity-50"
              >
                {updating ? "Updating..." : "Update now"}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
