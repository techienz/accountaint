export type EntityType = "company" | "sole_trader" | "partnership" | "trust";
export type GstFilingPeriod = "monthly" | "2monthly" | "6monthly";
export type ProvisionalTaxMethod = "standard" | "estimation" | "aim";
export type PayeFrequency = "monthly" | "twice_monthly";

export type TaxBracket = { threshold: number; rate: number };

/**
 * IRD kilometre-rate method (vehicle expense deduction).
 * Audit #72 — was a single $/km value; reality is per-fuel-type Tier 1/2.
 *
 * Tier 1 = first `tier1CapKm` of TOTAL vehicle km in the income year
 *          (business + private), per vehicle. Resets each income year.
 * Tier 2 = above the cap, running costs only.
 *
 * `noLogbookTier1CapKm` (3,500 km currently) is a separate safe harbour
 * that applies ONLY to OS 19/04b — employer reimbursing employee for
 * private vehicle business use without a logbook. Self-employed (OS 19/04a)
 * always need a logbook to use this method at all; the 3,500 km rule
 * doesn't apply to them.
 */
export type FuelType = "petrol" | "diesel" | "petrol_hybrid" | "electric";

export type KilometreTierRates = {
  tier1: number; // $/km, fixed + running, first N km
  tier2: number; // $/km, running only, above N km
};

export type KilometreRateConfig = {
  tier1CapKm: number;             // 14000 currently
  noLogbookTier1CapKm: number;    // 3500 (employee reimbursement only)
  rates: Record<FuelType, KilometreTierRates>;
  sourceOperationalStatement: string; // e.g. "OS 19/04-KM-2025"
};

export type TaxYearConfig = {
  year: number; // e.g. 2026 for year ending March 2026
  incomeTaxRate: { company: number; trust: number };
  gstRate: number;
  provisionalTaxDates: { standard: string[]; aim: string[] }; // MM-DD dates
  personalIncomeTaxBrackets: TaxBracket[];
  // DEPRECATED: single-rate fallback. Audit #72 — IRD now publishes
  // per-fuel-type Tier 1 / Tier 2 rates with a 14,000 km annual cap on
  // total vehicle km. New code should read kilometreRates instead.
  mileageRate: number; // $/km — Tier 1 petrol used as the headline default
  kilometreRates: KilometreRateConfig;
  /**
   * IRD square-metre rate for the home-office utilities/telco/depreciation
   * portion (OS 19/03 — CPI-adjusted annually). Audit #86.
   *
   * NOT a substitute for premises costs (rates, insurance, mortgage
   * interest, rent) — those still need to be itemised and prorated.
   */
  homeOfficeSqmRate: number; // $/m²/year
  fbtSingleRate: number; // e.g. 0.6393 = 63.93%
  lowValueAssetThreshold: number; // e.g. 1000
  accEarnerLevyRate: number; // per $100 of earnings
  // NOTE: prescribed interest rate moved out of TaxYearConfig (audit #77)
  // — IRD publishes quarterly by Order in Council and quarters don't
  // align with tax years. See src/lib/tax/rules/prescribed-interest-rates.ts.
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
