export type EntityType = "company" | "sole_trader" | "partnership" | "trust";
export type GstFilingPeriod = "monthly" | "2monthly" | "6monthly";
export type ProvisionalTaxMethod = "standard" | "estimation" | "aim";
export type PayeFrequency = "monthly" | "twice_monthly";

export type TaxBracket = { threshold: number; rate: number };

export type TaxYearConfig = {
  year: number; // e.g. 2026 for year ending March 2026
  incomeTaxRate: { company: number; trust: number };
  gstRate: number;
  provisionalTaxDates: { standard: string[]; aim: string[] }; // MM-DD dates
  personalIncomeTaxBrackets: TaxBracket[];
  mileageRate: number; // $/km
  fbtSingleRate: number; // e.g. 0.6393 = 63.93%
  lowValueAssetThreshold: number; // e.g. 1000
  accEarnerLevyRate: number; // per $100 of earnings
  prescribedInterestRate: number; // IRD prescribed rate for shareholder loans
  minimumWage: number; // adult minimum wage per hour
  minimumWageStartingOut: number; // starting-out/training minimum wage
  kiwisaverMinEmployerRate: number; // minimum employer contribution rate
  kiwisaverDefaultEmployeeRate: number; // default employee contribution rate
  studentLoanRepaymentRate: number;      // e.g. 0.12 for 12%
  studentLoanRepaymentThreshold: number; // annual income threshold before repayments start
  accEarnerLevyCap: number;              // max liable earnings for ACC earner levy
  esctBrackets: TaxBracket[];
  // Flat secondary-tax rates by tax code (SB/S/SH/ST/SA). IRD publishes these
  // separately from the marginal-bracket rates. Audit #117.
  secondaryTaxRates: Record<string, number>;
  // ND tax code rate — applied to employees who haven't supplied an IR330.
  nonDeclarationRate: number;
  studentLoanPerPeriodThresholds: {
    weekly: number;
    fortnightly: number;
  };
  payPeriodFactors: {
    weekly: number;
    fortnightly: number;
  };
  lastUpdated?: string;  // ISO date — when rules were last changed
  lastVerified?: string; // ISO date — when rules were last confirmed correct
  rulesVersion?: string; // e.g. "2027.1"
};
