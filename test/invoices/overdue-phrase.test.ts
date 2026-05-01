import { describe, expect, it } from "vitest";
import { buildOverduePhrase } from "@/lib/invoices/overdue-phrase";

describe("buildOverduePhrase", () => {
  it("returns 'is due today' when due date is today", () => {
    const today = new Date(2026, 4, 2); // 2 May 2026
    expect(buildOverduePhrase("2026-05-02", today)).toBe("is due today");
  });

  it("uses 'is due on DD-MM-YYYY' for future-dated invoices (early reminder)", () => {
    const today = new Date(2026, 4, 2);
    expect(buildOverduePhrase("2026-05-09", today)).toBe("is due on 09-05-2026");
  });

  it("uses singular day when 1 day overdue", () => {
    const today = new Date(2026, 4, 2);
    expect(buildOverduePhrase("2026-05-01", today)).toBe("is now 1 day overdue (was due 01-05-2026)");
  });

  it("uses plural days when multiple days overdue", () => {
    const today = new Date(2026, 4, 2);
    expect(buildOverduePhrase("2026-04-25", today)).toBe("is now 7 days overdue (was due 25-04-2026)");
  });

  it("formats due date as DD-MM-YYYY (NZ convention) not the ISO YYYY-MM-DD", () => {
    const today = new Date(2026, 4, 2);
    const phrase = buildOverduePhrase("2026-04-25", today);
    expect(phrase).toContain("25-04-2026");
    expect(phrase).not.toContain("2026-04-25");
  });

  it("falls back to a safe phrase when due date is malformed", () => {
    const today = new Date(2026, 4, 2);
    expect(buildOverduePhrase("not-a-date", today)).toBe("was due not-a-date");
  });

  it("counts in calendar days, not 24-hour windows (NZ DST resilience)", () => {
    // 31 March → 1 April spans the autumn DST end in NZ (3am back to 2am).
    // A naive (now - due)/86400000 calculation would round to 0 or 1
    // unpredictably; we use UTC midnights so the answer is always 1.
    const today = new Date(2026, 3, 1); // 1 Apr
    expect(buildOverduePhrase("2026-03-31", today)).toBe("is now 1 day overdue (was due 31-03-2026)");
  });
});
