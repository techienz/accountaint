/**
 * `npm run honesty` — run the honesty regression suite.
 *
 * Audit #130. The 8 questions live in src/lib/honesty/questions.ts;
 * rubric primitives in src/lib/honesty/rubric.ts; runner in
 * src/lib/honesty/runner.ts.
 *
 * This entry point currently uses a STUB responder that returns a
 * "not yet wired" response. The plumbing for a real chat-dispatcher
 * responder needs:
 *   1. Test-DB harness (in-memory SQLite + drizzle migrations applied)
 *   2. A seeded test business with known fixtures
 *   3. Anthropic API key + a per-question budget cap to avoid runaway
 *      costs in CI
 *
 * That harness is its own piece of work — tracked as a follow-up issue
 * after this scaffold lands. Until then, the script exits 0 and prints
 * a table of which questions WOULD be checked, so CI can wire the warn-
 * only job today and start running it the moment the harness is ready.
 */

import { runHonestyChecks, formatHonestySummary, type HonestyResponder } from "@/lib/honesty/runner";

const STUB_RESPONDER: HonestyResponder = async (question) => ({
  text: `[STUB] No live dispatcher wired. Question was: ${question}`,
  toolCalls: [],
});

async function main() {
  const stub = process.env.HONESTY_STUB === "1" || !process.env.ANTHROPIC_API_KEY;

  if (stub) {
    console.log("Honesty runner running in STUB mode (no live dispatcher).");
    console.log("Set HONESTY_STUB=0 + ANTHROPIC_API_KEY to enable real runs.");
    console.log("");
  }

  const summary = await runHonestyChecks(STUB_RESPONDER);
  console.log(formatHonestySummary(summary));

  // CI mode: exit 0 in stub mode (we expect failures since the responder
  // can't actually answer); exit non-zero only when a real responder is
  // wired and produced failures.
  if (stub) {
    console.log("Stub mode — exiting 0 regardless of pass/fail count.");
    process.exit(0);
  }

  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Honesty runner crashed:", err);
  process.exit(2);
});
