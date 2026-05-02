import { describe, expect, it } from "vitest";
import { runHonestyChecks, formatHonestySummary, type HonestyResponder } from "@/lib/honesty/runner";
import { HONESTY_QUESTIONS } from "@/lib/honesty/questions";

/**
 * End-to-end runner test using a synthetic responder. Audit #130.
 *
 * The runner is decoupled from a live chat dispatcher — production wires
 * a real responder, tests use a stub. These tests verify the runner's
 * own behaviour: filtering, error handling, summary stats.
 */

const ALWAYS_PASS_RESPONDER: HonestyResponder = async () => ({
  text: "39% with a $10,000 de minimis (IR1043). Refer to section HC 22 of the Income Tax Act 2007. Company rate 28%. GST threshold $60,000. Records 7 years. The square-metre method covers utilities; proportional prorates everything. Prescribed interest rate 5.77% currently.",
  toolCalls: [
    { name: "calculate_pay_run", input: {} },
    { name: "get_business_config", input: {} },
    { name: "calculate_prescribed_interest", input: {} },
  ],
});

const ALWAYS_FAIL_RESPONDER: HonestyResponder = async () => ({
  text: "I can't answer that — please consult an accountant.",
  toolCalls: [],
});

const THROWING_RESPONDER: HonestyResponder = async () => {
  throw new Error("simulated network failure");
};

describe("runHonestyChecks", () => {
  it("runs all questions when no filter supplied", async () => {
    const summary = await runHonestyChecks(ALWAYS_PASS_RESPONDER);
    expect(summary.total).toBe(HONESTY_QUESTIONS.length);
  });

  it("can filter to a subset by id", async () => {
    const summary = await runHonestyChecks(ALWAYS_PASS_RESPONDER, { ids: ["trustee-rate", "company-rate"] });
    expect(summary.total).toBe(2);
    expect(summary.results.map((r) => r.question.id).sort()).toEqual(["company-rate", "trustee-rate"]);
  });

  it("counts pass/fail correctly with a passing responder", async () => {
    const summary = await runHonestyChecks(ALWAYS_PASS_RESPONDER, { ids: ["trustee-rate"] });
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(0);
  });

  it("counts pass/fail correctly with a failing responder", async () => {
    const summary = await runHonestyChecks(ALWAYS_FAIL_RESPONDER, { ids: ["company-rate"] });
    expect(summary.passed).toBe(0);
    expect(summary.failed).toBe(1);
    expect(summary.results[0].reason).toBeTruthy();
  });

  it("captures responder errors as failures rather than crashing the whole run", async () => {
    const summary = await runHonestyChecks(THROWING_RESPONDER, { ids: ["trustee-rate"] });
    expect(summary.failed).toBe(1);
    expect(summary.results[0].reason).toContain("simulated network failure");
  });

  it("records duration per question", async () => {
    const summary = await runHonestyChecks(ALWAYS_PASS_RESPONDER, { ids: ["trustee-rate"] });
    expect(summary.results[0].durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("formatHonestySummary", () => {
  it("emits a header with pass/total ratio", async () => {
    const summary = await runHonestyChecks(ALWAYS_PASS_RESPONDER, { ids: ["trustee-rate"] });
    const out = formatHonestySummary(summary);
    expect(out).toMatch(/1\/1 passed/);
  });

  it("includes failure reason + 'catches' note for failing questions", async () => {
    const summary = await runHonestyChecks(ALWAYS_FAIL_RESPONDER, { ids: ["company-rate"] });
    const out = formatHonestySummary(summary);
    expect(out).toContain("FAIL");
    expect(out).toContain("catches:");
  });
});
