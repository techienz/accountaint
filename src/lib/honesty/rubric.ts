/**
 * Pure rubric primitives for the honesty test runner. Audit #130 (and
 * subsumes the rubric portion of #102).
 *
 * Each primitive takes a captured AI response (text + the tool calls
 * that fired during the turn) and returns a Pass/Fail with a one-line
 * reason. Composable via `all()` and `any()`.
 *
 * No DB. No network. Imported by both vitest unit tests (which feed
 * synthetic responses) and the runtime honesty script (which feeds
 * real dispatcher output).
 */

export type RubricResult = {
  passed: boolean;
  reason: string;
};

export type CapturedResponse = {
  /** Final assistant message text after all tool turns. */
  text: string;
  /** Tool calls that fired this turn, in order. */
  toolCalls: Array<{ name: string; input: unknown }>;
};

export type Rubric = (response: CapturedResponse) => RubricResult;

const IRD_GUIDE_PATTERN = /\b(IR\d{2,4}[A-Z]?)\b/i;
// "section CD 7B", "section HC 22", "s. 107", "§ 32" all match.
const SECTION_PATTERN = /\b(section|s\.|§)\s*[A-Z]*\s*\d+/i;

/** Response must cite an IRD source (guide code + section, OR a tax-technical URL). */
export function expectCitation(): Rubric {
  return (r) => {
    const hasGuide = IRD_GUIDE_PATTERN.test(r.text);
    const hasSection = SECTION_PATTERN.test(r.text);
    const hasUrl = /ird\.govt\.nz|taxtechnical\.ird\.govt\.nz|legislation\.govt\.nz/i.test(r.text);
    if (hasGuide || hasSection || hasUrl) {
      return { passed: true, reason: "cites IRD source" };
    }
    return { passed: false, reason: "no IRD guide / section / URL citation found" };
  };
}

const DEFLECTION_PHRASES = [
  /consult (?:an |a |your )?(?:accountant|tax (?:professional|advisor|specialist)|cpa)/i,
  /speak to (?:an |a |your )?(?:accountant|tax (?:professional|advisor|specialist))/i,
  /(?:i('m| am)|we) (?:not |un)able to (?:provide|give) (?:tax|legal) advice/i,
  /please consult/i,
  /seek professional advice/i,
];

/** Response must NOT deflect to "consult an accountant" — the app IS the accountant. */
export function expectNoDeflection(): Rubric {
  return (r) => {
    for (const p of DEFLECTION_PHRASES) {
      if (p.test(r.text)) {
        return { passed: false, reason: `deflection phrase matched: ${p}` };
      }
    }
    return { passed: true, reason: "no deflection" };
  };
}

/** Response must mention the exact rate as a percentage (e.g. "39%" or "0.39"). */
export function expectExactRate(rate: number): Rubric {
  const pct = (rate * 100);
  const patterns = [
    new RegExp(`\\b${pct}\\s*%`, "i"),
    new RegExp(`\\b${pct.toFixed(1)}\\s*%`, "i"),
    new RegExp(`\\b${rate.toFixed(2)}\\b`, "i"),
    new RegExp(`\\b${pct}\\s*percent\\b`, "i"),
  ];
  return (r) => {
    for (const p of patterns) {
      if (p.test(r.text)) return { passed: true, reason: `mentions ${pct}%` };
    }
    return { passed: false, reason: `does not mention ${pct}% / ${rate}` };
  };
}

/** Response must NOT mention a specific rate (catches hallucinations like the old 33% trustee rate). */
export function expectNotRate(rate: number, label?: string): Rubric {
  const pct = rate * 100;
  const patterns = [
    new RegExp(`\\b${pct}\\s*%`, "i"),
    new RegExp(`\\b${rate.toFixed(2)}\\b(?!\\d)`, "i"),
  ];
  return (r) => {
    for (const p of patterns) {
      if (p.test(r.text)) {
        return { passed: false, reason: `mentions disallowed rate ${label ?? pct + "%"}` };
      }
    }
    return { passed: true, reason: `does not mention ${label ?? pct + "%"}` };
  };
}

/** AI must have called a specific tool during this turn. Catches "answers from memory" antipattern. */
export function expectsToolCall(toolName: string): Rubric {
  return (r) => {
    const called = r.toolCalls.some((t) => t.name === toolName);
    return called
      ? { passed: true, reason: `called ${toolName}` }
      : { passed: false, reason: `did NOT call ${toolName} (called: ${r.toolCalls.map((t) => t.name).join(", ") || "none"})` };
  };
}

/** All rubrics must pass. */
export function all(...rubrics: Rubric[]): Rubric {
  return (r) => {
    for (const rub of rubrics) {
      const out = rub(r);
      if (!out.passed) return out;
    }
    return { passed: true, reason: "all rubrics passed" };
  };
}

/** At least one rubric must pass. */
export function any(...rubrics: Rubric[]): Rubric {
  return (r) => {
    const reasons: string[] = [];
    for (const rub of rubrics) {
      const out = rub(r);
      if (out.passed) return out;
      reasons.push(out.reason);
    }
    return { passed: false, reason: `none of: ${reasons.join("; ")}` };
  };
}
