import { describe, it, expect } from "vitest";
import { calculateDeadlines, type DeadlineInput } from "@/lib/tax/deadlines";

const baseConfig: Omit<DeadlineInput, "entity_type" | "tax_agent_linked" | "dateRange"> = {
  balance_date: "03-31",
  gst_registered: false,
  has_employees: false,
};

function filingDeadlines(extra: Partial<DeadlineInput>) {
  const input: DeadlineInput = {
    ...baseConfig,
    entity_type: "company",
    dateRange: {
      from: new Date("2026-04-01"),
      to: new Date("2027-08-31"),
    },
    ...extra,
  };
  return calculateDeadlines(input).filter((d) =>
    ["ir3", "ir4", "ir6", "ir7"].includes(d.type),
  );
}

function terminalTaxDeadlines(extra: Partial<DeadlineInput>) {
  const input: DeadlineInput = {
    ...baseConfig,
    entity_type: "company",
    dateRange: {
      from: new Date("2026-04-01"),
      to: new Date("2027-08-31"),
    },
    ...extra,
  };
  return calculateDeadlines(input).filter((d) => d.type === "income_tax");
}

describe("Income tax filing deadlines (IR3/IR4/IR6/IR7)", () => {
  it("Company without tax agent: IR4 for 2026 tax year due 7 July 2026", () => {
    const deadlines = filingDeadlines({});
    const ir4 = deadlines.find((d) => d.type === "ir4" && d.taxYear === 2026);
    expect(ir4).toBeDefined();
    expect(ir4?.dueDate).toBe("2026-07-07");
    expect(ir4?.description).toContain("IR4");
    expect(ir4?.description).not.toContain("tax agent extension");
  });

  it("Company WITH tax agent: IR4 for 2026 due 31 March 2027", () => {
    const deadlines = filingDeadlines({ tax_agent_linked: true });
    const ir4 = deadlines.find((d) => d.type === "ir4" && d.taxYear === 2026);
    expect(ir4).toBeDefined();
    expect(ir4?.dueDate).toBe("2027-03-31");
    expect(ir4?.description).toContain("tax agent extension");
  });

  it("Sole trader: IR3 for 2026 due 7 July 2026 (no extension)", () => {
    const deadlines = filingDeadlines({ entity_type: "sole_trader" });
    const ir3 = deadlines.find((d) => d.type === "ir3" && d.taxYear === 2026);
    expect(ir3).toBeDefined();
    expect(ir3?.dueDate).toBe("2026-07-07");
  });

  it("Trust: IR6 for 2026", () => {
    const deadlines = filingDeadlines({ entity_type: "trust" });
    const ir6 = deadlines.find((d) => d.type === "ir6" && d.taxYear === 2026);
    expect(ir6).toBeDefined();
    expect(ir6?.dueDate).toBe("2026-07-07");
  });

  it("Partnership: IR7 for 2026", () => {
    const deadlines = filingDeadlines({ entity_type: "partnership" });
    const ir7 = deadlines.find((d) => d.type === "ir7" && d.taxYear === 2026);
    expect(ir7).toBeDefined();
    expect(ir7?.dueDate).toBe("2026-07-07");
  });

  it("Filing entry is separate from terminal tax payment entry", () => {
    const deadlines = filingDeadlines({});
    const terminalTax = terminalTaxDeadlines({});
    const ir4 = deadlines.find((d) => d.type === "ir4" && d.taxYear === 2026);
    const tt = terminalTax.find((d) => d.taxYear === 2026);
    expect(ir4).toBeDefined();
    expect(tt).toBeDefined();
    // Different dates: filing 7 July, terminal tax 7 February next year
    expect(ir4?.dueDate).not.toBe(tt?.dueDate);
  });
});

describe("Terminal tax deadlines (with tax-agent extension)", () => {
  it("Company without tax agent: terminal tax for 2026 due 7 February 2027", () => {
    const deadlines = terminalTaxDeadlines({});
    const tt = deadlines.find((d) => d.taxYear === 2026);
    expect(tt).toBeDefined();
    // 7 Feb 2027 is Sunday; 8 Feb 2027 is Waitangi Day observed (Mon
    // because 6 Feb falls on Saturday); next working day is Tue 9 Feb.
    expect(tt?.dueDate).toBe("2027-02-09");
    expect(tt?.description).not.toContain("tax agent extension");
  });

  it("Company WITH tax agent: terminal tax for 2026 due 7 April 2027", () => {
    const deadlines = terminalTaxDeadlines({ tax_agent_linked: true });
    const tt = deadlines.find((d) => d.taxYear === 2026);
    expect(tt).toBeDefined();
    expect(tt?.dueDate).toBe("2027-04-07"); // 7 Apr 2027 is Wednesday
    expect(tt?.description).toContain("tax agent extension");
  });
});
