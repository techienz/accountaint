import { describe, it, expect } from "vitest";
import { calculateDeadlines, type DeadlineInput } from "@/lib/tax/deadlines";

const baseConfig: Omit<DeadlineInput, "entity_type" | "dateRange"> = {
  balance_date: "03-31",
  gst_registered: false,
  has_employees: false,
};

function annualReturns(extra: Partial<DeadlineInput>) {
  const input: DeadlineInput = {
    ...baseConfig,
    entity_type: "company",
    dateRange: {
      from: new Date("2024-01-01"),
      to: new Date("2030-12-31"),
    },
    ...extra,
  };
  return calculateDeadlines(input).filter((d) => d.type === "annual_return");
}

describe("Companies Office annual return (#164)", () => {
  it("uses companies_office_annual_return_month when set, ignoring incorporation_date.month", () => {
    const ars = annualReturns({
      incorporation_date: "2025-03-15", // March
      companies_office_annual_return_month: 9, // September
    });
    expect(ars.length).toBeGreaterThan(0);
    // Every entry should be in September (month 9), last day = 30 Sep
    for (const ar of ars) {
      expect(ar.dueDate.slice(5, 10)).toBe("09-30");
    }
  });

  it("falls back to incorporation_date.month when registrar field is null", () => {
    const ars = annualReturns({
      incorporation_date: "2025-03-15",
      companies_office_annual_return_month: null,
    });
    // Falls back to March; last day of March = 31
    expect(ars.length).toBeGreaterThan(0);
    for (const ar of ars) {
      expect(ar.dueDate.slice(5, 10)).toBe("03-31");
    }
  });

  it("skips the year of incorporation (first AR is in year+1)", () => {
    const ars = annualReturns({
      incorporation_date: "2025-03-15",
      companies_office_annual_return_month: 3,
    });
    const incYearAR = ars.find((d) => d.dueDate === "2025-03-31");
    expect(incYearAR).toBeUndefined();
    // But year+1 should have one
    const nextYearAR = ars.find((d) => d.dueDate === "2026-03-31");
    expect(nextYearAR).toBeDefined();
  });

  it("emits no annual returns for non-company entities", () => {
    const ars = annualReturns({
      entity_type: "sole_trader",
      incorporation_date: "2025-03-15",
    });
    expect(ars).toHaveLength(0);
  });

  it("emits nothing if neither field is set", () => {
    const ars = annualReturns({
      incorporation_date: undefined,
      companies_office_annual_return_month: null,
    });
    expect(ars).toHaveLength(0);
  });

  it("handles registrar-assigned non-anniversary month for restored company", () => {
    // Company incorporated in March but registrar-assigned month is October
    // (e.g. after a restoration that reset the filing schedule).
    const ars = annualReturns({
      incorporation_date: "2025-03-15",
      companies_office_annual_return_month: 10,
    });
    for (const ar of ars) {
      expect(ar.dueDate.slice(5, 10)).toBe("10-31");
    }
    // Year of incorporation still skipped
    expect(ars.find((d) => d.dueDate === "2025-10-31")).toBeUndefined();
    // First AR is October 2026
    expect(ars.find((d) => d.dueDate === "2026-10-31")).toBeDefined();
  });
});
