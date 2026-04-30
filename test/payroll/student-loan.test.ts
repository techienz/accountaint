import { describe, expect, it } from "vitest";
import { calculateStudentLoan } from "@/lib/payroll/calculator";

/**
 * 2026 SL repayment rate: 12%
 * Per-period thresholds: weekly $464, fortnightly $928
 */

describe("calculateStudentLoan (2026)", () => {
  const TY = 2026;

  it("returns 0 if tax code does not include SL", () => {
    expect(calculateStudentLoan(2000, "weekly", "M", TY)).toBe(0);
  });

  it("returns 0 if gross pay below per-period threshold (weekly)", () => {
    expect(calculateStudentLoan(400, "weekly", "M SL", TY)).toBe(0);
  });

  it("returns 0 at exactly the weekly threshold", () => {
    expect(calculateStudentLoan(464, "weekly", "M SL", TY)).toBe(0);
  });

  it("computes 12% on amount over weekly threshold", () => {
    // ($1000 - $464) × 0.12 = $64.32
    expect(calculateStudentLoan(1000, "weekly", "M SL", TY)).toBe(64.32);
  });

  it("computes 12% on amount over fortnightly threshold", () => {
    // ($2000 - $928) × 0.12 = $128.64
    expect(calculateStudentLoan(2000, "fortnightly", "M SL", TY)).toBe(128.64);
  });

  it("secondary code SB SL applies flat 12% on full gross (no threshold)", () => {
    // SB is secondary → SL applies to full gross
    expect(calculateStudentLoan(1000, "weekly", "SB SL", TY)).toBe(120);
  });

  it("secondary code S SL applies flat 12% on full gross", () => {
    expect(calculateStudentLoan(500, "weekly", "S SL", TY)).toBe(60);
  });

  it("zero gross pay → zero", () => {
    expect(calculateStudentLoan(0, "weekly", "M SL", TY)).toBe(0);
  });
});
