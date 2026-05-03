import { describe, it, expect } from "vitest";
import { calculateDeadlines, type DeadlineInput } from "@/lib/tax/deadlines";

const baseConfig: Omit<DeadlineInput, "gst_filing_period" | "gst_2monthly_cycle" | "dateRange"> = {
  entity_type: "company",
  balance_date: "03-31",
  gst_registered: true,
  has_employees: false,
};

function gstDeadlines(extra: Partial<DeadlineInput>) {
  const input: DeadlineInput = {
    ...baseConfig,
    gst_filing_period: "2monthly",
    dateRange: {
      from: new Date("2026-04-01"),
      to: new Date("2027-03-31"),
    },
    ...extra,
  };
  return calculateDeadlines(input).filter((d) => d.type === "gst");
}

describe("GST deadlines — 2-monthly cycle", () => {
  it("Cycle A (default when unset): periods end Jan/Mar/May/Jul/Sep/Nov", () => {
    const deadlines = gstDeadlines({});
    const dueDates = deadlines.map((d) => d.dueDate);
    // Apr-May 2026 (period ends 31 May) → due 28 June (working day adjusted)
    expect(dueDates).toContain("2026-06-29"); // 28 Jun 2026 is Sunday
    // Jun-Jul 2026 (period ends 31 Jul) → due 28 Aug
    expect(dueDates).toContain("2026-08-28");
    // Aug-Sep 2026 (period ends 30 Sep) → due 28 Oct
    expect(dueDates).toContain("2026-10-28");
    // Oct-Nov 2026 (period ends 30 Nov) → due 15 Jan 2027 (special)
    expect(dueDates).toContain("2027-01-15");
  });

  it("Cycle A explicit: same as unset", () => {
    const a = gstDeadlines({ gst_2monthly_cycle: "A" });
    const unset = gstDeadlines({});
    expect(a.map((d) => d.dueDate)).toEqual(unset.map((d) => d.dueDate));
  });

  it("Cycle B: periods end Feb/Apr/Jun/Aug/Oct/Dec", () => {
    const deadlines = gstDeadlines({ gst_2monthly_cycle: "B" });
    const dueDates = deadlines.map((d) => d.dueDate);
    // Mar-Apr 2026 (period ends 30 Apr) → due 28 May 2026 — the user's actual case
    expect(dueDates).toContain("2026-05-28");
    // May-Jun 2026 (period ends 30 Jun) → due 28 Jul
    expect(dueDates).toContain("2026-07-28");
    // Jul-Aug 2026 (period ends 31 Aug) → due 28 Sep
    expect(dueDates).toContain("2026-09-28");
    // Sep-Oct 2026 (period ends 31 Oct) → due 30 Nov 2026 (28 Nov is Sat → next working day)
    expect(dueDates).toContain("2026-11-30");
    // Nov-Dec 2026 (period ends 31 Dec) → due 28 Jan 2027 (Cycle B does NOT get the 15 Jan special — that's only for Cycle A's Nov period)
    expect(dueDates).toContain("2027-01-28");
  });

  it("Cycle A and Cycle B produce different sets", () => {
    const a = gstDeadlines({ gst_2monthly_cycle: "A" });
    const b = gstDeadlines({ gst_2monthly_cycle: "B" });
    const aDates = new Set(a.map((d) => d.dueDate));
    const bDates = new Set(b.map((d) => d.dueDate));
    // No overlap expected on the period structure within the test window
    expect([...aDates].some((d) => bDates.has(d))).toBe(false);
  });

  it("Cycle B: April period description names Mar-Apr (not Feb-Mar)", () => {
    const deadlines = gstDeadlines({ gst_2monthly_cycle: "B" });
    const aprPeriod = deadlines.find((d) => d.dueDate === "2026-05-28");
    expect(aprPeriod).toBeDefined();
    expect(aprPeriod?.description).toContain("Mar-Apr 2026");
  });

  it("Cycle B: Feb period (Jan-Feb 2027) → due 28 Mar (no special exception)", () => {
    // The 7-May exception only applies to March period ends (Cycle A's Feb-Mar
    // period). Cycle B's Feb period gets the standard 28th-of-following-month.
    const deadlines = gstDeadlines({
      gst_2monthly_cycle: "B",
      dateRange: {
        from: new Date("2026-04-01"),
        to: new Date("2027-04-30"),
      },
    });
    const febPeriod = deadlines.find(
      (d) => d.description?.includes("Jan-Feb 2027")
    );
    expect(febPeriod).toBeDefined();
    // 28 Mar 2027 is Easter Sunday; Mon 29 Mar is Easter Monday (public
    // holiday); next working day is Tue 30 Mar.
    expect(febPeriod?.dueDate).toBe("2027-03-30");
  });
});
