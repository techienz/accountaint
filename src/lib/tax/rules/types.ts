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
  lastUpdated?: string;  // ISO date — when rules were last changed
  lastVerified?: string; // ISO date — when rules were last confirmed correct
  rulesVersion?: string; // e.g. "2027.1"
};
