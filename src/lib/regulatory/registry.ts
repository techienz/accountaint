import { getTaxYearConfig, getPrescribedInterestRate, type TaxYearConfig } from "@/lib/tax/rules";

export type RegulatoryArea = {
  id: string;
  label: string;
  description: string; // what Claude should search for
  getCurrentValue: (config: TaxYearConfig) => unknown;
  formatForDisplay: (value: unknown) => string;
  configField: string; // field name in TaxYearConfig
  /**
   * Authoritative source URLs for this rate. The verifier will cite these
   * to Claude as the primary place to look, reducing the chance the AI
   * confirms a value from a stale cached page or its prior training data.
   * Where possible, point at the IRD/MBIE page that lists the rate with
   * an "as at" date.
   */
  canonicalSources?: string[];
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
    description:
      "NZ personal income tax brackets and rates for individuals. NOTE: brackets changed effective 31 July 2024 (composite year for 2025); the current set $15,600 / $53,500 / $78,100 / $180,000 applies from 1 April 2025 forward unless a later change supersedes it.",
    getCurrentValue: (c) => c.personalIncomeTaxBrackets,
    formatForDisplay: formatBrackets,
    configField: "personalIncomeTaxBrackets",
    canonicalSources: [
      "https://www.ird.govt.nz/income-tax/income-tax-for-individuals/tax-codes-and-tax-rates-for-individuals/tax-rates-for-individuals",
    ],
  },
  {
    id: "acc_earner_levy_rate",
    label: "ACC Earner Levy Rate",
    description: "ACC earner levy rate per $100 of liable earnings",
    getCurrentValue: (c) => c.accEarnerLevyRate,
    formatForDisplay: (v) => `$${Number(v)} per $100`,
    configField: "accEarnerLevyRate",
    canonicalSources: [
      "https://www.acc.co.nz/for-business/contributing-to-acc/work-account-levies/",
      "https://www.ird.govt.nz/employing-staff/payday-filing/non-electronic-filing/acc-earners-levy",
    ],
  },
  {
    id: "acc_earner_levy_cap",
    label: "ACC Earner Levy Cap",
    description: "Maximum liable earnings for ACC earner levy",
    getCurrentValue: (c) => c.accEarnerLevyCap,
    formatForDisplay: formatCurrency,
    configField: "accEarnerLevyCap",
    canonicalSources: [
      "https://www.acc.co.nz/for-business/contributing-to-acc/work-account-levies/",
    ],
  },
  {
    id: "student_loan_threshold",
    label: "Student Loan Repayment Threshold",
    description: "Annual income threshold before student loan repayments start",
    getCurrentValue: (c) => c.studentLoanRepaymentThreshold,
    formatForDisplay: formatCurrency,
    configField: "studentLoanRepaymentThreshold",
    canonicalSources: [
      "https://www.ird.govt.nz/student-loans/repaying-my-student-loan/student-loan-repayment-thresholds-rates",
    ],
  },
  {
    id: "student_loan_rate",
    label: "Student Loan Repayment Rate",
    description: "Student loan repayment rate as a percentage of income above threshold",
    getCurrentValue: (c) => c.studentLoanRepaymentRate,
    formatForDisplay: formatPercent,
    configField: "studentLoanRepaymentRate",
    canonicalSources: [
      "https://www.ird.govt.nz/student-loans/repaying-my-student-loan/student-loan-repayment-thresholds-rates",
    ],
  },
  {
    id: "kiwisaver_min_employer",
    label: "KiwiSaver Minimum Employer Rate",
    description: "Minimum compulsory employer KiwiSaver contribution rate",
    getCurrentValue: (c) => c.kiwisaverMinEmployerRate,
    formatForDisplay: formatPercent,
    configField: "kiwisaverMinEmployerRate",
    canonicalSources: [
      "https://www.ird.govt.nz/kiwisaver/kiwisaver-employers/contributing-to-kiwisaver/employer-contributions",
    ],
  },
  {
    id: "kiwisaver_default_employee",
    label: "KiwiSaver Default Employee Rate",
    description: "Default employee KiwiSaver contribution rate",
    getCurrentValue: (c) => c.kiwisaverDefaultEmployeeRate,
    formatForDisplay: formatPercent,
    configField: "kiwisaverDefaultEmployeeRate",
    canonicalSources: [
      "https://www.ird.govt.nz/kiwisaver/kiwisaver-employees/contribution-rates",
    ],
  },
  {
    id: "minimum_wage",
    label: "Minimum Wage",
    description: "NZ adult minimum wage per hour",
    getCurrentValue: (c) => c.minimumWage,
    formatForDisplay: (v) => `$${Number(v).toFixed(2)}/hr`,
    configField: "minimumWage",
    canonicalSources: [
      "https://www.employment.govt.nz/pay-and-hours/pay-and-wages/minimum-wage",
    ],
  },
  {
    id: "minimum_wage_starting_out",
    label: "Starting-Out Minimum Wage",
    description: "NZ starting-out/training minimum wage per hour",
    getCurrentValue: (c) => c.minimumWageStartingOut,
    formatForDisplay: (v) => `$${Number(v).toFixed(2)}/hr`,
    configField: "minimumWageStartingOut",
    canonicalSources: [
      "https://www.employment.govt.nz/pay-and-hours/pay-and-wages/minimum-wage",
    ],
  },
  {
    id: "esct_brackets",
    label: "ESCT Brackets",
    description: "Employer Superannuation Contribution Tax (ESCT) rate brackets",
    getCurrentValue: (c) => c.esctBrackets,
    formatForDisplay: formatBrackets,
    configField: "esctBrackets",
    canonicalSources: [
      "https://www.ird.govt.nz/kiwisaver/kiwisaver-employers/making-deductions/work-out-the-tax-rate-on-your-employer-contributions",
    ],
  },
  {
    id: "prescribed_interest_rate",
    label: "Prescribed Interest Rate (current quarter)",
    description: "IRD prescribed interest rate for FBT low-interest loans. Published quarterly by Order in Council under the Income Tax (Fringe Benefit Tax, Interest on Loans) Regulations 1995. Audit #77 — was a single annual scalar; now a quarterly timeline.",
    // Pull the current quarter's rate from the dynamic timeline rather than
    // a per-year config field. The TaxYearConfig argument is unused here.
    getCurrentValue: () => getPrescribedInterestRate(new Date()),
    formatForDisplay: formatPercent,
    configField: "prescribedInterestRates",
    canonicalSources: [
      "https://www.ird.govt.nz/topics/employer-fringe-benefit-tax-paye-information/prescribed-interest-rates",
    ],
  },
  {
    id: "gst_rate",
    label: "GST Rate",
    description: "NZ Goods and Services Tax rate",
    getCurrentValue: (c) => c.gstRate,
    formatForDisplay: formatPercent,
    configField: "gstRate",
    canonicalSources: [
      "https://www.ird.govt.nz/gst/charging-gst",
    ],
  },
  {
    id: "company_tax_rate",
    label: "Company Tax Rate",
    description: "NZ company income tax rate",
    getCurrentValue: (c) => c.incomeTaxRate.company,
    formatForDisplay: formatPercent,
    configField: "incomeTaxRate.company",
    canonicalSources: [
      "https://www.ird.govt.nz/income-tax/income-tax-for-businesses-and-organisations/income-tax-rates-for-businesses",
    ],
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
