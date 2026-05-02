import type { TaxYearConfig } from "./types";

/**
 * NZ tax year ending 31 March 2027.
 *
 * Standard provisional tax dates for March balance date entities:
 *   - 28 August 2026 (P1)
 *   - 15 January 2027 (P2)
 *   - 7 May 2027 (P3 — after balance date)
 *
 * AIM provisional tax: due 28th of months 2, 4, 6, 8, 10, 12 of the tax year.
 */
export const taxYear2027: TaxYearConfig = {
  year: 2027,
  // Trustee tax rate: 39% (with $10,000 de minimis at 33%). See 2026.ts comment.
  incomeTaxRate: { company: 0.28, trust: 0.39 },
  gstRate: 0.15,
  provisionalTaxDates: {
    standard: ["08-28", "01-15", "05-07"],
    aim: ["05-28", "07-28", "09-28", "11-28", "01-28", "03-28"],
  },
  personalIncomeTaxBrackets: [
    { threshold: 15600, rate: 0.105 },
    { threshold: 53500, rate: 0.175 },
    { threshold: 78100, rate: 0.30 },
    { threshold: 180000, rate: 0.33 },
    { threshold: Infinity, rate: 0.39 },
  ],
  // Single-rate fallback retained for backward compatibility. Equals the
  // petrol Tier 1 rate. Audit #72.
  mileageRate: 1.17,
  kilometreRates: {
    tier1CapKm: 14000,
    noLogbookTier1CapKm: 3500,
    sourceOperationalStatement: "OS 19/04-KM-2025 (used as 2027 placeholder until OS 19/04-KM-2027 is published)",
    rates: {
      petrol:        { tier1: 1.17, tier2: 0.37 },
      diesel:        { tier1: 1.26, tier2: 0.35 },
      petrol_hybrid: { tier1: 0.86, tier2: 0.21 },
      electric:      { tier1: 1.08, tier2: 0.19 },
    },
  },
  fbtSingleRate: 0.6393,
  // IRD square-metre rate for home office (OS 19/03 CPI-adjusted).
  // 2027 rate not yet published; using 2025 figure as placeholder. Audit #86.
  homeOfficeSqmRate: 55.60,
  lowValueAssetThreshold: 1000,
  accEarnerLevyRate: 1.75,
  minimumWage: 23.95,
  minimumWageStartingOut: 19.16,
  kiwisaverMinEmployerRate: 0.035,
  kiwisaverDefaultEmployeeRate: 0.035,
  studentLoanRepaymentRate: 0.12,
  studentLoanRepaymentThreshold: 24128,
  accEarnerLevyCap: 156641,
  esctBrackets: [
    { threshold: 18720, rate: 0.105 },
    { threshold: 64200, rate: 0.175 },
    { threshold: 93720, rate: 0.30 },
    { threshold: 216000, rate: 0.33 },
    { threshold: Infinity, rate: 0.39 },
  ],
  secondaryTaxRates: {
    SB: 0.105,
    S: 0.175,
    SH: 0.30,
    ST: 0.33,
    SA: 0.39,
  },
  nonDeclarationRate: 0.45,
  studentLoanPerPeriodThresholds: {
    weekly: 464,
    fortnightly: 928,
  },
  payPeriodFactors: {
    weekly: 52,
    fortnightly: 26,
  },
  lastUpdated: "2026-04-09",
  lastVerified: "2026-04-09",
  rulesVersion: "2027.2",
};
