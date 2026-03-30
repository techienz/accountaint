"use client";

import { useState } from "react";

type QuestionItem = {
  id: string;
  suggested_question: string;
  title: string;
  severity: string;
  status: string;
};

export function QuestionsList({
  questions: initial,
}: {
  questions: QuestionItem[];
}) {
  const [questions, setQuestions] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const pending = questions.filter((q) => q.status !== "asked");
  const asked = questions.filter((q) => q.status === "asked");

  async function copyAll() {
    const text = pending
      .map((q, i) => `${i + 1}. ${q.suggested_question}`)
      .join("\n\n");

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function markAsAsked(id: string) {
    setUpdating(id);
    try {
      const res = await fetch(`/api/crosscheck/anomalies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "asked" }),
      });
      if (res.ok) {
        setQuestions((prev) =>
          prev.map((q) => (q.id === id ? { ...q, status: "asked" } : q))
        );
      }
    } finally {
      setUpdating(null);
    }
  }

  if (questions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No questions to ask. When changes are detected, suggested questions will
        appear here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {pending.length} {pending.length === 1 ? "question" : "questions"}{" "}
              for your next accountant meeting
            </p>
            <button
              onClick={copyAll}
              className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
            >
              {copied ? "Copied!" : "Copy all"}
            </button>
          </div>

          <ol className="space-y-3 list-decimal list-inside">
            {pending.map((q) => (
              <li key={q.id} className="text-sm">
                <span>{q.suggested_question}</span>
                <button
                  onClick={() => markAsAsked(q.id)}
                  disabled={updating === q.id}
                  className="ml-2 rounded px-2 py-0.5 text-xs border text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Mark as asked
                </button>
              </li>
            ))}
          </ol>
        </>
      )}

      {asked.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            {asked.length} already asked
          </summary>
          <ol className="mt-2 space-y-1 list-decimal list-inside opacity-60">
            {asked.map((q) => (
              <li key={q.id}>{q.suggested_question}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
