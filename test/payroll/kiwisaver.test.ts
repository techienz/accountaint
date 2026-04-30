import { describe, expect, it } from "vitest";
import { calculateKiwisaver } from "@/lib/payroll/calculator";

describe("calculateKiwisaver", () => {
  it("non-enrolled employee → both zero", () => {
    expect(calculateKiwisaver(1000, false, 0.03, 0.03)).toEqual({
      employee: 0,
      employer: 0,
    });
  });

  it("zero gross pay → both zero", () => {
    expect(calculateKiwisaver(0, true, 0.03, 0.03)).toEqual({
      employee: 0,
      employer: 0,
    });
  });

  it("3% employee + 3% employer on $1000 → $30 each", () => {
    expect(calculateKiwisaver(1000, true, 0.03, 0.03)).toEqual({
      employee: 30,
      employer: 30,
    });
  });

  it("4% employee + 3% employer on $1500 → $60 / $45", () => {
    expect(calculateKiwisaver(1500, true, 0.04, 0.03)).toEqual({
      employee: 60,
      employer: 45,
    });
  });

  it("8% employee on $2000 → $160", () => {
    expect(calculateKiwisaver(2000, true, 0.08, 0.03)).toEqual({
      employee: 160,
      employer: 60,
    });
  });

  it("10% employee on $1234.56 rounds to two dp", () => {
    // 1234.56 × 0.10 = 123.456 → 123.46 (round half up to two dp)
    expect(calculateKiwisaver(1234.56, true, 0.10, 0.03).employee).toBe(123.46);
  });
});
