import { getTaxYearConfig, getPrescribedInterestRate, type TaxYearConfig } from "@/lib/tax/rules";

export type RegulatoryArea = {
  id: string;
  label: string;
  description: string; // what Claude should search for
  getCurrentValue: (config: TaxYearConfig) => unknown;
  formatForDisplay: (value: unknown) => string;
  configField: string; // field name in TaxYearConfig
};

function formatBrackets(value: unknown): string {
  const brackets = value as { threshold: number; rate: number }[];
  return brackets
    .map((b) =>
      b.threshold === Infinity
        ? `Above @ ${(b.rate * 100).toFixed(1)}%`
        : `$${b.threshold.toLocaleString()} @ ${(b.rate * 100).toFixed(1)}%`
    )
    .join(", ");
}

function formatCurrency(value: unknown): string {
  return `$${Number(value).toLocaleString("en-NZ", { minimumFractionDigits: 2 })}`;
}

function formatRate(value: unknown): string {
  return `${Number(value)}`;
}

function formatPercent(value: unknown): string {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

export const REGULATORY_AREAS: RegulatoryArea[] = [
  {
    id: "income_tax_brackets",
    label: "Income Tax Brackets",
    description: "NZ personal income tax brackets and rates for individuals",
    getCurrentValue: (c) => c.personalIncomeTaxBrackets,
    formatForDisplay: formatBrackets,
    configField: "personalIncomeTaxBrackets",
  },
  {
    id: "acc_earner_levy_rate",
    label: "ACC Earner Levy Rate",
    description: "ACC earner levy rate per $100 of liable earnings",
    getCurrentValue: (c) => c.accEarnerLevyRate,
    formatForDisplay: (v) => `$${Number(v)} per $100`,
    configField: "accEarnerLevyRate",
  },
  {
    id: "acc_earner_levy_cap",
    label: "ACC Earner Levy Cap",
    description: "Maximum liable earnings for ACC earner levy",
    getCurrentValue: (c) => c.accEarnerLevyCap,
    formatForDisplay: formatCurrency,
    configField: "accEarnerLevyCap",
  },
  {
    id: "student_loan_threshold",
    label: "Student Loan Repayment Threshold",
    description: "Annual income threshold before student loan repayments start",
    getCurrentValue: (c) => c.studentLoanRepaymentThreshold,
    formatForDisplay: formatCurrency,
    configField: "studentLoanRepaymentThreshold",
  },
  {
    id: "student_loan_rate",
    label: "Student Loan Repayment Rate",
    description: "Student loan repayment rate as a percentage of income above threshold",
    getCurrentValue: (c) => c.studentLoanRepaymentRate,
    formatForDisplay: formatPercent,
    configField: "studentLoanRepaymentRate",
  },
  {
    id: "kiwisaver_min_employer",
    label: "KiwiSaver Minimum Employer Rate",
    description: "Minimum compulsory employer KiwiSaver contribution rate",
    getCurrentValue: (c) => c.kiwisaverMinEmployerRate,
    formatForDisplay: formatPercent,
    configField: "kiwisaverMinEmployerRate",
  },
  {
    id: "kiwisaver_default_employee",
    label: "KiwiSaver Default Employee Rate",
    description: "Default employee KiwiSaver contribution rate",
    getCurrentValue: (c) => c.kiwisaverDefaultEmployeeRate,
    formatForDisplay: formatPercent,
    configField: "kiwisaverDefaultEmployeeRate",
  },
  {
    id: "minimum_wage",
    label: "Minimum Wage",
    description: "NZ adult minimum wage per hour",
    getCurrentValue: (c) => c.minimumWage,
    formatForDisplay: (v) => `$${Number(v).toFixed(2)}/hr`,
    configField: "minimumWage",
  },
  {
    id: "minimum_wage_starting_out",
    label: "Starting-Out Minimum Wage",
    description: "NZ starting-out/training minimum wage per hour",
    getCurrentValue: (c) => c.minimumWageStartingOut,
    formatForDisplay: (v) => `$${Number(v).toFixed(2)}/hr`,
    configField: "minimumWageStartingOut",
  },
  {
    id: "esct_brackets",
    label: "ESCT Brackets",
    description: "Employer Superannuation Contribution Tax (ESCT) rate brackets",
    getCurrentValue: (c) => c.esctBrackets,
    formatForDisplay: formatBrackets,
    configField: "esctBrackets",
  },
  {
    id: "prescribed_interest_rate",
    label: "Prescribed Interest Rate (current quarter)",
    description: "IRD prescribed interest rate for shareholder current account loans. Published quarterly by Order in Council. Audit #77 — was a single annual scalar; now a quarterly timeline.",
    // Pull the current quarter's rate from the dynamic timeline rather than
    // a per-year config field. The TaxYearConfig argument is unused here.
    getCurrentValue: () => getPrescribedInterestRate(new Date()),
    formatForDisplay: formatPercent,
    configField: "prescribedInterestRates",
  },
  {
    id: "gst_rate",
    label: "GST Rate",
    description: "NZ Goods and Services Tax rate",
    getCurrentValue: (c) => c.gstRate,
    formatForDisplay: formatPercent,
    configField: "gstRate",
  },
  {
    id: "company_tax_rate",
    label: "Company Tax Rate",
    description: "NZ company income tax rate",
    getCurrentValue: (c) => c.incomeTaxRate.company,
    formatForDisplay: formatPercent,
    configField: "incomeTaxRate.company",
  },
];

export function getCurrentValues(taxYear: number): Record<string, { area: RegulatoryArea; value: unknown; display: string }> {
  const config = getTaxYearConfig(taxYear);
  const result: Record<string, { area: RegulatoryArea; value: unknown; display: string }> = {};

  for (const area of REGULATORY_AREAS) {
    const value = area.getCurrentValue(config);
    result[area.id] = {
      area,
      value,
      display: area.formatForDisplay(value),
    };
  }

  return result;
}
