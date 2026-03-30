"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ summary: string; level: string } | null>(null);
  const router = useRouter();

  async function handleReview() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/crosscheck/review", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult({
          summary: data.summary,
          level: data.overall_level,
        });
        router.refresh();
      } else {
        setResult({ summary: data.error || "Review failed", level: "error" });
      }
    } catch {
      setResult({ summary: "Failed to connect", level: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleReview}
        disabled={loading}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {loading ? "Reviewing..." : "AI Review"}
      </button>
      {result && (
        <p className="text-xs text-muted-foreground max-w-xs text-right">
          {result.summary}
        </p>
      )}
    </div>
  );
}
