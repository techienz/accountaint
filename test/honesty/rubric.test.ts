import { describe, expect, it } from "vitest";
import {
  expectCitation,
  expectNoDeflection,
  expectExactRate,
  expectNotRate,
  expectsToolCall,
  all,
  any,
} from "@/lib/honesty/rubric";
import type { CapturedResponse } from "@/lib/honesty/rubric";

/**
 * Pure tests for the honesty rubric primitives. Audit #130.
 * No API calls, no DB. Each test feeds a synthetic CapturedResponse
 * into the rubric and asserts pass/fail.
 */

function r(text: string, toolCalls: { name: string; input?: unknown }[] = []): CapturedResponse {
  return { text, toolCalls: toolCalls.map((t) => ({ name: t.name, input: t.input ?? {} })) };
}

describe("expectCitation", () => {
  it("passes when an IRD guide code is mentioned", () => {
    expect(expectCitation()(r("See IR320 for company tax info.")).passed).toBe(true);
  });

  it("passes when a section reference is mentioned", () => {
    expect(expectCitation()(r("Refer to section CD 7B of the Income Tax Act.")).passed).toBe(true);
  });

  it("passes when an ird.govt.nz URL is mentioned", () => {
    expect(expectCitation()(r("https://www.ird.govt.nz/income-tax/...")).passed).toBe(true);
  });

  it("fails on a generic answer with no citation", () => {
    expect(expectCitation()(r("The trustee tax rate is 39%.")).passed).toBe(false);
  });
});

describe("expectNoDeflection", () => {
  it("fails when 'consult an accountant' appears", () => {
    const out = expectNoDeflection()(r("Please consult an accountant before deciding."));
    expect(out.passed).toBe(false);
  });

  it("fails when 'speak to a tax professional' appears", () => {
    expect(expectNoDeflection()(r("Speak to a tax professional.")).passed).toBe(false);
  });

  it("fails when 'I am unable to provide tax advice' appears", () => {
    expect(expectNoDeflection()(r("I am unable to provide tax advice.")).passed).toBe(false);
  });

  it("passes a direct, confident answer with no deflection language", () => {
    expect(expectNoDeflection()(r("Yes — for a March balance date, your P3 is 7 May.")).passed).toBe(true);
  });
});

describe("expectExactRate", () => {
  it("passes 'is 39%'", () => {
    expect(expectExactRate(0.39)(r("The trustee rate is 39%.")).passed).toBe(true);
  });

  it("passes 'is 39.0%'", () => {
    expect(expectExactRate(0.39)(r("The rate is 39.0% currently.")).passed).toBe(true);
  });

  it("passes 'is 0.39'", () => {
    expect(expectExactRate(0.39)(r("Rate as decimal: 0.39")).passed).toBe(true);
  });

  it("passes 'is 39 percent'", () => {
    expect(expectExactRate(0.39)(r("That's 39 percent.")).passed).toBe(true);
  });

  it("fails when no matching rate appears", () => {
    expect(expectExactRate(0.39)(r("The rate has changed recently.")).passed).toBe(false);
  });
});

describe("expectNotRate", () => {
  it("fails when the disallowed rate appears", () => {
    // Catches the OLD trustee rate hallucination — pre-audit-fix #64.
    expect(expectNotRate(0.33)(r("The trustee rate is 33%.")).passed).toBe(false);
  });

  it("passes when the disallowed rate does not appear", () => {
    expect(expectNotRate(0.33)(r("The trustee rate is 39% with a $10,000 de minimis.")).passed).toBe(true);
  });
});

describe("expectsToolCall", () => {
  it("passes when the named tool was called", () => {
    expect(expectsToolCall("calculate_pay_run")(r("response", [{ name: "calculate_pay_run" }])).passed).toBe(true);
  });

  it("fails when the named tool was NOT called", () => {
    expect(expectsToolCall("calculate_pay_run")(r("response", [])).passed).toBe(false);
  });

  it("lists actually-called tools in the failure reason", () => {
    const out = expectsToolCall("calculate_pay_run")(r("response", [{ name: "get_employees" }]));
    expect(out.passed).toBe(false);
    expect(out.reason).toContain("get_employees");
  });
});

describe("all() and any() composition", () => {
  it("all() short-circuits on the first failure", () => {
    const rubric = all(expectExactRate(0.39), expectCitation());
    const out = rubric(r("39% but no citation"));
    expect(out.passed).toBe(false);
    expect(out.reason).toMatch(/citation/i);
  });

  it("all() passes only when every rubric passes", () => {
    const rubric = all(expectExactRate(0.39), expectNoDeflection());
    expect(rubric(r("The rate is 39%.")).passed).toBe(true);
  });

  it("any() passes when at least one rubric passes", () => {
    const rubric = any(expectsToolCall("foo"), expectExactRate(0.39));
    expect(rubric(r("39%")).passed).toBe(true);
  });

  it("any() lists every rubric's reason on overall failure", () => {
    const rubric = any(expectsToolCall("foo"), expectExactRate(0.50));
    const out = rubric(r("response"));
    expect(out.passed).toBe(false);
    expect(out.reason).toContain("foo");
    expect(out.reason).toContain("50%");
  });
});
