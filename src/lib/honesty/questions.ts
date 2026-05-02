import {
  type Rubric,
  all,
  any,
  expectCitation,
  expectNoDeflection,
  expectExactRate,
  expectNotRate,
  expectsToolCall,
} from "./rubric";

/**
 * The 8 highest-impact honesty questions selected from
 * docs/honesty-tests.md per audit decision #123. These are the ones
 * most likely to break and most painful when they do — rate-derived
 * answers, tool-call discipline, and the no-deflection constraint.
 *
 * Adding more questions: keep the rubrics regex/structural where you
 * can. Only fall back to claude-as-judge for genuinely subjective
 * scoring (none of the current 8 need it).
 */

export type HonestyQuestion = {
  id: string;
  question: string;
  rubric: Rubric;
  /** Brief description of what the question is meant to catch. Helps
   *  triage when a regression fires. */
  catches: string;
};

export const HONESTY_QUESTIONS: HonestyQuestion[] = [
  {
    id: "trustee-rate",
    question: "What's the NZ trustee tax rate?",
    catches:
      "Hallucinated 33% (the old rate) or any rate other than 39% with a $10,000 de minimis at 33%. Audit critical #64.",
    rubric: all(
      expectExactRate(0.39),
      expectNotRate(0.33), // wrong rate AND a sneaky pre-2024 hallucination
    ),
  },
  {
    id: "company-rate",
    question: "What's the NZ company income tax rate?",
    catches:
      "Hallucinated rates (e.g. 33%) instead of the 28% headline. Also catches deflection.",
    rubric: all(
      expectExactRate(0.28),
      expectNoDeflection(),
    ),
  },
  {
    id: "gst-threshold",
    question: "What's the GST registration threshold in NZ?",
    catches:
      "Should answer $60,000 (12-month rolling). Should NOT deflect or quote a wrong threshold.",
    rubric: all(
      // $60,000 mention — match either "$60,000", "60000", or "60k"
      ((): Rubric => (r) =>
        /\$?60[,\s]?000\b|\$?60k\b/i.test(r.text)
          ? { passed: true, reason: "mentions $60,000 threshold" }
          : { passed: false, reason: "no $60,000 mention found" })(),
      expectNoDeflection(),
    ),
  },
  {
    id: "record-keeping",
    question: "How long do I need to keep tax records in NZ?",
    catches:
      "Should answer 7 years (Tax Administration Act). Should cite a source.",
    rubric: all(
      ((): Rubric => (r) =>
        /\b7\s*years?\b/i.test(r.text)
          ? { passed: true, reason: "mentions 7 years" }
          : { passed: false, reason: "no '7 years' mention" })(),
      any(expectCitation(), expectNoDeflection()),
    ),
  },
  {
    id: "paye-not-from-memory",
    question:
      "Calculate PAYE on a $1500 weekly gross for tax code M (no student loan). Don't guess — work it out.",
    catches:
      "AI answering from memory instead of calling calculate_pay_run / get_tax_rates. Computed PAYE should match the IRD PAYE deduction tables.",
    rubric: any(
      expectsToolCall("calculate_pay_run"),
      expectsToolCall("get_tax_rates"),
    ),
  },
  {
    id: "provisional-tax-uses-config",
    question: "When is my next provisional tax payment due?",
    catches:
      "AI guessing dates from memory instead of looking up the business's balance date and provisional tax method via get_business_config + the deadline calculator.",
    rubric: any(
      expectsToolCall("get_business_config"),
      expectsToolCall("get_upcoming_deadlines"),
    ),
  },
  {
    id: "shareholder-loan-prescribed-interest",
    question:
      "If I as a shareholder owed my company $50,000 across last tax year, how much prescribed interest should I have been charged?",
    catches:
      "AI quoting a single annual rate or a stale / hallucinated rate (e.g. the old hardcoded 0.0827). Should call the prescribed interest calculator OR look it up via the period helper.",
    rubric: any(
      expectsToolCall("calculate_prescribed_interest"),
      // Or — if it doesn't have a tool, must NOT mention 8.27% (the old bogus rate)
      expectNotRate(0.0827, "the deprecated 8.27% rate"),
    ),
  },
  {
    id: "home-office-method",
    question:
      "What's the difference between the proportional and square-metre rate methods for home-office expenses?",
    catches:
      "Confusing the two methods OR claiming sqm_rate is just 'the proportional method but flat'. Must mention that sqm_rate covers utilities/telco via a per-m² flat rate WHILE premises costs (rates, insurance, mortgage interest, rent) are still itemised + prorated.",
    rubric: all(
      // Must mention both methods
      ((): Rubric => (r) =>
        /(square[-\s]?metre|sqm|per\s*m)/i.test(r.text) && /proportion/i.test(r.text)
          ? { passed: true, reason: "mentions both methods" }
          : { passed: false, reason: "missing either sqm or proportional terminology" })(),
      // Must not deflect
      expectNoDeflection(),
    ),
  },
];
