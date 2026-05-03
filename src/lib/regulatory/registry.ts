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

// Canonical URLs — only included where the path is verified or follows a
// well-known IRD/MBIE structure. URLs the verifier can't confirm 200 on
// would silently fall back to general search and risk the same stale-cached
// regression we're trying to prevent. Better to leave them out and rely on
// the prompt's general-search instruction for the area than to point the AI
// at a broken URL. Any deep IRD paths added below should be re-verified
// when IRD changes their site IA (which happens periodically).
export const REGULATORY_AREAS: RegulatoryArea[] = [
  {
    id: "income_tax_brackets",
    label: "Income Tax Brackets",
    description:
      "NZ personal income tax brackets and rates for individuals. Note: brackets changed effective 31 July 2024 (with a composite-year calculation for tax year 2025). For tax years 2026 onwards a single set applies. Verify against the current IRD page — do not regress to the pre-change set.",
    getCurrentValue: (c) => c.personalIncomeTaxBrackets,
    formatForDisplay: formatBrackets,
    configField: "personalIncomeTaxBrackets",
    canonicalSources: [
      // Verified by user screenshot 2026-05-03; this page lists the
      // current set with effective-from headers.
      "https://www.ird.govt.nz/income-tax/income-tax-for-individuals/tax-codes-and-tax-rates-for-individuals/tax-rates-for-individuals",
    ],
  },
  {
    id: "acc_earner_levy_rate",
    label: "ACC Earner Levy Rate",
    description: "ACC earner levy rate per $100 of liable earnings, paid via PAYE. Note: the Earners' Account levy is distinct from the Work Account levy (which is the employer's levy on employee wages). The earner levy is reviewed annually.",
    getCurrentValue: (c) => c.accEarnerLevyRate,
    formatForDisplay: (v) => `$${Number(v)} per $100`,
    configField: "accEarnerLevyRate",
    // Canonical URL omitted — IRD/ACC IA shifts the earner-levy page
    // location, and the Work Account vs Earners' Account split is a
    // common source of misdirection. Let general search handle this.
  },
  {
    id: "acc_earner_levy_cap",
    label: "ACC Earner Levy Cap",
    description: "Maximum liable earnings (ceiling) for the ACC earner levy each tax year. Reviewed annually.",
    getCurrentValue: (c) => c.accEarnerLevyCap,
    formatForDisplay: formatCurrency,
    configField: "accEarnerLevyCap",
    // Canonical URL omitted — see acc_earner_levy_rate.
  },
  {
    id: "student_loan_threshold",
    label: "Student Loan Repayment Threshold",
    description: "Annual income threshold before student loan repayments start. Reviewed annually.",
    getCurrentValue: (c) => c.studentLoanRepaymentThreshold,
    formatForDisplay: formatCurrency,
    configField: "studentLoanRepaymentThreshold",
    canonicalSources: [
      "https://www.ird.govt.nz/student-loans",
    ],
  },
  {
    id: "student_loan_rate",
    label: "Student Loan Repayment Rate",
    description: "Student loan repayment rate as a percentage of income above the repayment threshold.",
    getCurrentValue: (c) => c.studentLoanRepaymentRate,
    formatForDisplay: formatPercent,
    configField: "studentLoanRepaymentRate",
    canonicalSources: [
      "https://www.ird.govt.nz/student-loans",
    ],
  },
  {
    id: "kiwisaver_min_employer",
    label: "KiwiSaver Minimum Employer Rate",
    description: "Minimum compulsory employer KiwiSaver contribution rate.",
    getCurrentValue: (c) => c.kiwisaverMinEmployerRate,
    formatForDisplay: formatPercent,
    configField: "kiwisaverMinEmployerRate",
    canonicalSources: [
      "https://www.ird.govt.nz/kiwisaver",
    ],
  },
  {
    id: "kiwisaver_default_employee",
    label: "KiwiSaver Default Employee Rate",
    description: "Default employee KiwiSaver contribution rate.",
    getCurrentValue: (c) => c.kiwisaverDefaultEmployeeRate,
    formatForDisplay: formatPercent,
    configField: "kiwisaverDefaultEmployeeRate",
    canonicalSources: [
      "https://www.ird.govt.nz/kiwisaver",
    ],
  },
  {
    id: "minimum_wage",
    label: "Minimum Wage",
    description: "NZ adult minimum wage per hour. Reviewed annually by MBIE; usually changes 1 April.",
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
    description: "NZ starting-out/training minimum wage per hour.",
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
    description: "Employer Superannuation Contribution Tax (ESCT) rate brackets. Note: the bottom three thresholds shifted effective 30 July 2024 to mirror the personal income tax bracket changes; verify the current set on IRD's KiwiSaver employer guidance.",
    getCurrentValue: (c) => c.esctBrackets,
    formatForDisplay: formatBrackets,
    configField: "esctBrackets",
    canonicalSources: [
      "https://www.ird.govt.nz/kiwisaver",
    ],
  },
  {
    id: "prescribed_interest_rate",
    label: "Prescribed Interest Rate (current quarter)",
    description: "IRD prescribed interest rate for FBT low-interest loans. Published quarterly by Order in Council under the Income Tax (Fringe Benefit Tax, Interest on Loans) Regulations 1995; statutory anchor is ITA 2007 s RD 35. Audit #77 — was a single annual scalar; now a quarterly timeline.",
    // Pull the current quarter's rate from the dynamic timeline rather than
    // a per-year config field. The TaxYearConfig argument is unused here.
    getCurrentValue: () => getPrescribedInterestRate(new Date()),
    formatForDisplay: formatPercent,
    configField: "prescribedInterestRates",
    // Canonical URL omitted — IRD's FBT prescribed-interest page has moved
    // multiple times. Let general search handle this; the description
    // gives the AI enough to find the OIC by name.
  },
  {
    id: "gst_rate",
    label: "GST Rate",
    description: "NZ Goods and Services Tax standard rate. Has been 15% since 1 October 2010.",
    getCurrentValue: (c) => c.gstRate,
    formatForDisplay: formatPercent,
    configField: "gstRate",
    canonicalSources: [
      "https://www.ird.govt.nz/gst",
    ],
  },
  {
    id: "company_tax_rate",
    label: "Company Tax Rate",
    description: "NZ company income tax rate (currently 28% since the 2011-12 income year).",
    getCurrentValue: (c) => c.incomeTaxRate.company,
    formatForDisplay: formatPercent,
    configField: "incomeTaxRate.company",
    canonicalSources: [
      "https://www.ird.govt.nz/income-tax/income-tax-for-businesses-and-organisations",
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
