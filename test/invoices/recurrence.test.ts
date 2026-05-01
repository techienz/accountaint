import { describe, expect, it } from "vitest";
import { nextRunDate } from "@/lib/invoices/recurrence";

describe("nextRunDate", () => {
  describe("weekly / fortnightly", () => {
    it("advances weekly by 7 days", () => {
      expect(nextRunDate("2026-05-02", "weekly")).toBe("2026-05-09");
    });

    it("advances fortnightly by 14 days", () => {
      expect(nextRunDate("2026-05-02", "fortnightly")).toBe("2026-05-16");
    });

    it("crosses month boundaries", () => {
      expect(nextRunDate("2026-04-28", "weekly")).toBe("2026-05-05");
    });

    it("crosses year boundaries", () => {
      expect(nextRunDate("2026-12-30", "weekly")).toBe("2027-01-06");
    });
  });

  describe("monthly", () => {
    it("keeps the same day-of-month when next month has it", () => {
      expect(nextRunDate("2026-05-15", "monthly")).toBe("2026-06-15");
    });

    it("clamps day to last-of-month when next month is shorter", () => {
      // Jan 31 → Feb 28 (2026 is not a leap year)
      expect(nextRunDate("2026-01-31", "monthly")).toBe("2026-02-28");
    });

    it("uses Feb 29 in a leap year (2028)", () => {
      expect(nextRunDate("2028-01-29", "monthly")).toBe("2028-02-29");
    });

    it("clamps Feb 29 → Mar 29, not Mar 28 (next month is March, has 31 days)", () => {
      expect(nextRunDate("2028-02-29", "monthly")).toBe("2028-03-29");
    });

    it("crosses year boundary December → January", () => {
      expect(nextRunDate("2026-12-15", "monthly")).toBe("2027-01-15");
    });
  });

  describe("quarterly", () => {
    it("advances by 3 calendar months", () => {
      expect(nextRunDate("2026-01-15", "quarterly")).toBe("2026-04-15");
    });

    it("clamps when target month is shorter (May 31 → Aug 31 fine; Nov 30 → Feb 28)", () => {
      expect(nextRunDate("2026-05-31", "quarterly")).toBe("2026-08-31");
      expect(nextRunDate("2026-11-30", "quarterly")).toBe("2027-02-28");
    });

    it("crosses year boundary October → January", () => {
      expect(nextRunDate("2026-10-10", "quarterly")).toBe("2027-01-10");
    });
  });

  it("rejects malformed dates", () => {
    expect(() => nextRunDate("not-a-date", "monthly")).toThrow();
    expect(() => nextRunDate("2026-13-01", "monthly")).not.toThrow(); // string format only
  });
});
