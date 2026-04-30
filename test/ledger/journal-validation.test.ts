import { describe, expect, it } from "vitest";
import { createJournalEntry } from "@/lib/ledger/journals";

/**
 * Validation tests for createJournalEntry — these exercise input checks that
 * throw BEFORE the DB call, so no fixture DB is required. Catches regressions
 * in the balance / non-negative / non-empty / either-debit-or-credit rules.
 *
 * NOTE: tests that need a real DB (e.g., asserting persisted rows match
 * inputs) are tracked separately and require the test-DB harness in #28
 * follow-up work.
 */

describe("createJournalEntry — input validation", () => {
  const ANY_BIZ = "test-business";

  it("throws if debits ≠ credits", () => {
    expect(() =>
      createJournalEntry(ANY_BIZ, {
        date: "2026-04-01",
        description: "unbalanced",
        source_type: "manual",
        lines: [
          { account_id: "a1", debit: 100, credit: 0 },
          { account_id: "a2", debit: 0, credit: 50 }, // 50 short
        ],
      })
    ).toThrow(/unbalanced/i);
  });

  it("throws if fewer than 2 lines (balance check passes first)", () => {
    // Single zero-amount line: balance check (0 - 0 = 0) passes, then min-lines fails
    expect(() =>
      createJournalEntry(ANY_BIZ, {
        date: "2026-04-01",
        description: "one line",
        source_type: "manual",
        lines: [{ account_id: "a1", debit: 0, credit: 0 }],
      })
    ).toThrow(/at least 2 lines/i);
  });

  it("throws if a line has both debit and credit > 0", () => {
    expect(() =>
      createJournalEntry(ANY_BIZ, {
        date: "2026-04-01",
        description: "ambiguous",
        source_type: "manual",
        lines: [
          { account_id: "a1", debit: 100, credit: 50 }, // both > 0
          { account_id: "a2", debit: 0, credit: 50 },
        ],
      })
    ).toThrow(/both debit and credit/i);
  });

  it("throws on negative debit", () => {
    expect(() =>
      createJournalEntry(ANY_BIZ, {
        date: "2026-04-01",
        description: "negative",
        source_type: "manual",
        lines: [
          { account_id: "a1", debit: -100, credit: 0 },
          { account_id: "a2", debit: 0, credit: -100 },
        ],
      })
    ).toThrow(/non-negative/i);
  });

  it("accepts tiny rounding-tolerance differences (< $0.01)", () => {
    // Fails ONLY when diff >= 0.01. So a 0.005 diff (real-world float drift)
    // should fall through validation and reach the DB call. We can't easily
    // assert it succeeds without a DB, but we can confirm it doesn't throw
    // the "unbalanced" error — any error from this call must be a DB error,
    // not a balance error.
    let threw: Error | undefined;
    try {
      createJournalEntry(ANY_BIZ, {
        date: "2026-04-01",
        description: "near-balanced",
        source_type: "manual",
        lines: [
          { account_id: "a1", debit: 100.005, credit: 0 },
          { account_id: "a2", debit: 0, credit: 100.0 },
        ],
      });
    } catch (e) {
      threw = e as Error;
    }
    if (threw) {
      expect(threw.message).not.toMatch(/unbalanced/i);
    }
  });
});
