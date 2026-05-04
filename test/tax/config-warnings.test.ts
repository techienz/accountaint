import { describe, it, expect } from "vitest";
import {
  detectConfigWarnings,
  type WarnableBusinessConfig,
} from "@/lib/tax/config-warnings";

const fullyConfigured: WarnableBusinessConfig = {
  entity_type: "company",
  gst_registered: true,
  gst_filing_period: "2monthly",
  gst_2monthly_cycle: "B",
  has_employees: false,
  paye_frequency: null,
  provisional_tax_method: "standard",
  incorporation_date: "2020-04-01",
  companies_office_annual_return_month: 4,
  pays_dividends: true,
  has_shareholder_employee: true,
};

describe("detectConfigWarnings (#170)", () => {
  it("returns empty array when fully configured", () => {
    const w = detectConfigWarnings(fullyConfigured);
    expect(w).toHaveLength(0);
  });

  it("flags GST-registered with no filing period", () => {
    const w = detectConfigWarnings({
      ...fullyConfigured,
      gst_filing_period: null,
      gst_2monthly_cycle: null,
    });
    const ids = w.map((x) => x.id);
    expect(ids).toContain("gst_registered_no_period");
    const filing = w.find((x) => x.id === "gst_registered_no_period");
    expect(filing?.severity).toBe("error");
  });

  it("flags 2-monthly GST without cycle as warning (not error)", () => {
    const w = detectConfigWarnings({
      ...fullyConfigured,
      gst_2monthly_cycle: null,
    });
    const cycleW = w.find((x) => x.id === "gst_2monthly_no_cycle");
    expect(cycleW).toBeDefined();
    expect(cycleW?.severity).toBe("warning");
  });

  it("flags employees without PAYE frequency", () => {
    const w = detectConfigWarnings({
      ...fullyConfigured,
      has_employees: true,
      paye_frequency: null,
    });
    expect(w.some((x) => x.id === "employees_no_paye_frequency")).toBe(true);
  });

  it("flags missing provisional tax method", () => {
    const w = detectConfigWarnings({
      ...fullyConfigured,
      provisional_tax_method: null,
    });
    expect(w.some((x) => x.id === "no_provisional_tax_method")).toBe(true);
  });

  it("flags company missing both incorporation_date and annual-return month", () => {
    const w = detectConfigWarnings({
      ...fullyConfigured,
      incorporation_date: null,
      companies_office_annual_return_month: null,
    });
    expect(w.some((x) => x.id === "company_no_annual_return_month")).toBe(true);
  });

  it("does not flag company missing annual-return month if incorporation_date is set", () => {
    const w = detectConfigWarnings({
      ...fullyConfigured,
      companies_office_annual_return_month: null,
    });
    expect(w.some((x) => x.id === "company_no_annual_return_month")).toBe(false);
  });

  it("does not flag annual-return for non-company entities", () => {
    const w = detectConfigWarnings({
      ...fullyConfigured,
      entity_type: "sole_trader",
      incorporation_date: null,
      companies_office_annual_return_month: null,
    });
    expect(w.some((x) => x.id === "company_no_annual_return_month")).toBe(false);
  });
});
