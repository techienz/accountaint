import { describe, expect, it } from "vitest";
import { calculateProvisionalTax } from "@/lib/tax/provisional";

/**
 * Provisional tax — standard method = prior year RIT × 1.05, split into 3
 * equal instalments (last one absorbs rounding). Estimation method uses the
 * provided amount directly.
 *
 * 2026 standard dates (March balance): 28-Aug, 15-Jan, 7-May (next-working-day
 * applied to weekend dates).
 */

describe("calculateProvisionalTax — standard (2026)", () => {
  it("uses prior-year RIT × 1.05 as totalDue", () => {
    const result = calculateProvisionalTax("standard", 2026, 30000, "03-31");
    expect(result.totalDue).toBe(31500); // 30,000 × 1.05
  });

  it("splits totalDue into 3 instalments", () => {
    const result = calculateProvisionalTax("standard", 2026, 30000, "03-31");
    expect(result.instalments).toHaveLength(3);
    // Each instalment ~$10,500; last absorbs any rounding diff
    const sum = result.instalments.reduce((s, i) => s + i.amountDue, 0);
    expect(sum).toBeCloseTo(31500, 2);
  });

  it("instalment dates fall on or after the standard P1/P2/P3 calendar months", () => {
    const result = calculateProvisionalTax("standard", 2026, 30000, "03-31");
    const months = result.instalments.map((i) => parseInt(i.dueDate.split("-")[1], 10));
    // Standard dates: Aug, Jan, May
    expect(months).toEqual([8, 1, 5]);
  });

  it("last instalment absorbs the rounding remainder so sum matches totalDue exactly", () => {
    // 1,000 × 1.05 = 1,050; /3 = 350 each — clean
    const clean = calculateProvisionalTax("standard", 2026, 1000, "03-31");
    expect(clean.instalments.map((i) => i.amountDue)).toEqual([350, 350, 350]);

    // Numbers that don't divide evenly should still sum to totalDue
    const messy = calculateProvisionalTax("standard", 2026, 99, "03-31");
    const sum = messy.instalments.reduce((s, i) => s + i.amountDue, 0);
    expect(Math.round(sum * 100) / 100).toBe(messy.totalDue);
  });

  it("zero prior-year RIT → all instalments zero", () => {
    const result = calculateProvisionalTax("standard", 2026, 0, "03-31");
    expect(result.totalDue).toBe(0);
    expect(result.instalments.every((i) => i.amountDue === 0)).toBe(true);
  });
});

describe("calculateProvisionalTax — estimation (2026)", () => {
  it("uses the provided amount as totalDue (no 1.05 uplift)", () => {
    const result = calculateProvisionalTax("estimation", 2026, 25000, "03-31");
    expect(result.totalDue).toBe(25000);
  });

  it("uses standard dates (3 instalments)", () => {
    const result = calculateProvisionalTax("estimation", 2026, 25000, "03-31");
    expect(result.instalments).toHaveLength(3);
  });
});

describe("calculateProvisionalTax — AIM (2026)", () => {
  it("uses 6 instalments (every 2 months)", () => {
    const result = calculateProvisionalTax("aim", 2026, 30000, "03-31");
    expect(result.instalments).toHaveLength(6);
  });

  it("instalment months for March balance: May, Jul, Sep, Nov, Jan, Mar", () => {
    const result = calculateProvisionalTax("aim", 2026, 30000, "03-31");
    const months = result.instalments.map((i) => parseInt(i.dueDate.split("-")[1], 10));
    expect(months).toEqual([5, 7, 9, 11, 1, 3]);
  });
});
