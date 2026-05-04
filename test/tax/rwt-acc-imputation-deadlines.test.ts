import { describe, it, expect } from "vitest";
import { calculateDeadlines, type DeadlineInput } from "@/lib/tax/deadlines";

const baseConfig: Omit<
  DeadlineInput,
  | "entity_type"
  | "pays_dividends"
  | "has_shareholder_employee"
  | "has_employees"
  | "dateRange"
> = {
  balance_date: "03-31",
  gst_registered: false,
};

function deadlinesOfType(type: string, extra: Partial<DeadlineInput>) {
  const input: DeadlineInput = {
    ...baseConfig,
    entity_type: "company",
    has_employees: false,
    dateRange: {
      from: new Date("2026-04-01"),
      to: new Date("2027-08-31"),
    },
    ...extra,
  };
  return calculateDeadlines(input).filter((d) => d.type === type);
}

describe("RWT on dividends (#165)", () => {
  it("emits monthly IR15P when pays_dividends is true", () => {
    const monthly = deadlinesOfType("rwt_dividend_payment", { pays_dividends: true });
    // Range Apr 2026 → Aug 2027 = 17 months. The 20th of each month
    // covers payments from the previous month, so we get one entry
    // per month.
    expect(monthly.length).toBeGreaterThan(12);
    // First entry: 20 April 2026 covering March 2026 dividends
    const apr2026 = monthly.find((d) => d.dueDate === "2026-04-20");
    expect(apr2026?.description).toContain("Mar 2026");
  });

  it("does NOT emit a 31 May annual reconciliation — Investment Income Reporting regime has no annual return", () => {
    // Per IR284 (Oct 2025) verification: the legacy "IR15S" annual
    // reconciliation does not exist under the current regime.
    // Calendar-only emissions are the monthly 20th. The 20-April
    // over-deduction-correction window in IR284 page 19 is event-driven
    // and not surfaced as a recurring deadline.
    const all = deadlinesOfType("rwt_dividend_payment", { pays_dividends: true });
    const may = all.find((d) => d.dueDate === "2027-05-31" || d.dueDate === "2027-06-01");
    // 31 May entry should only appear if it's a 20th-of-monthly payment
    // (i.e. nothing on the 31st). Confirm no 31 May entry exists.
    expect(may).toBeUndefined();
  });

  it("emits no RWT when pays_dividends is false", () => {
    const monthly = deadlinesOfType("rwt_dividend_payment", { pays_dividends: false });
    expect(monthly).toHaveLength(0);
  });
});

describe("IR4J Imputation Credit Account return (#166)", () => {
  it("emits for company with same date as IR4 (no extension)", () => {
    const ir4j = deadlinesOfType("imputation_return", {});
    const tx2026 = ir4j.find((d) => d.taxYear === 2026);
    expect(tx2026?.dueDate).toBe("2026-07-07");
    expect(tx2026?.description).toContain("IR4J");
  });

  it("uses tax-agent extension date when set", () => {
    const ir4j = deadlinesOfType("imputation_return", { tax_agent_linked: true });
    const tx2026 = ir4j.find((d) => d.taxYear === 2026);
    expect(tx2026?.dueDate).toBe("2027-03-31");
    expect(tx2026?.description).toContain("tax agent extension");
  });

  it("does not emit for non-company entities", () => {
    const ir4jSole = deadlinesOfType("imputation_return", { entity_type: "sole_trader" });
    const ir4jTrust = deadlinesOfType("imputation_return", { entity_type: "trust" });
    expect(ir4jSole).toHaveLength(0);
    expect(ir4jTrust).toHaveLength(0);
  });
});

describe("ACC Work Account levy (#168)", () => {
  it("emits for sole trader (self-employed cadence)", () => {
    const acc = deadlinesOfType("acc_levy", { entity_type: "sole_trader" });
    expect(acc.length).toBeGreaterThan(0);
    expect(acc[0].description).toContain("self-employed");
  });

  it("emits for company with shareholder-employee (self-employed cadence)", () => {
    const acc = deadlinesOfType("acc_levy", {
      entity_type: "company",
      has_shareholder_employee: true,
    });
    expect(acc.length).toBeGreaterThan(0);
    expect(acc[0].description).toContain("self-employed");
  });

  it("emits for employer with employees (employer cadence)", () => {
    const acc = deadlinesOfType("acc_levy", {
      entity_type: "company",
      has_employees: true,
    });
    expect(acc.length).toBeGreaterThan(0);
    expect(acc[0].description).toContain("employer");
  });

  it("does NOT emit for company with no employees and no shareholder-employee", () => {
    const acc = deadlinesOfType("acc_levy", {
      entity_type: "company",
      has_employees: false,
      has_shareholder_employee: false,
    });
    expect(acc).toHaveLength(0);
  });

  it("does NOT emit for trust without employees", () => {
    const acc = deadlinesOfType("acc_levy", {
      entity_type: "trust",
      has_employees: false,
      has_shareholder_employee: false,
    });
    expect(acc).toHaveLength(0);
  });
});
