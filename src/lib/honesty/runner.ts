import { HONESTY_QUESTIONS, type HonestyQuestion } from "./questions";
import type { CapturedResponse } from "./rubric";

/**
 * The "responder" abstraction. The runner is decoupled from how a
 * question gets answered — production wires a real chat-dispatcher
 * responder (sends the question through the live AI loop, captures
 * text + tool calls); tests use a stub responder that returns
 * synthetic responses.
 *
 * This keeps the rubric pipeline and CLI independent of the chat
 * pipeline's runtime requirements (Anthropic API key, test DB, etc.).
 */
export type HonestyResponder = (question: string) => Promise<CapturedResponse>;

export type HonestyRunResult = {
  question: HonestyQuestion;
  response: CapturedResponse;
  passed: boolean;
  reason: string;
  durationMs: number;
};

export type HonestyRunSummary = {
  total: number;
  passed: number;
  failed: number;
  results: HonestyRunResult[];
};

/**
 * Run all (or a filtered subset of) honesty questions through a
 * responder, grading each with the rubric attached to the question.
 */
export async function runHonestyChecks(
  responder: HonestyResponder,
  filter?: { ids?: string[] },
): Promise<HonestyRunSummary> {
  const questions = filter?.ids
    ? HONESTY_QUESTIONS.filter((q) => filter.ids!.includes(q.id))
    : HONESTY_QUESTIONS;

  const results: HonestyRunResult[] = [];
  for (const q of questions) {
    const start = Date.now();
    let response: CapturedResponse;
    try {
      response = await responder(q.question);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        question: q,
        response: { text: `(responder error: ${message})`, toolCalls: [] },
        passed: false,
        reason: `responder threw: ${message}`,
        durationMs: Date.now() - start,
      });
      continue;
    }
    const grade = q.rubric(response);
    results.push({
      question: q,
      response,
      passed: grade.passed,
      reason: grade.reason,
      durationMs: Date.now() - start,
    });
  }

  return {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };
}

/** Pretty-print a summary for the CLI / CI log. */
export function formatHonestySummary(summary: HonestyRunSummary): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`Honesty regression suite — ${summary.passed}/${summary.total} passed`);
  lines.push("─".repeat(60));
  for (const r of summary.results) {
    const badge = r.passed ? "PASS" : "FAIL";
    lines.push(`${badge}  ${r.question.id.padEnd(36)}  ${r.durationMs}ms`);
    if (!r.passed) {
      lines.push(`        ↳ ${r.reason}`);
      lines.push(`        ↳ catches: ${r.question.catches}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}
