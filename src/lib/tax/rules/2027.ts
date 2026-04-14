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
  incomeTaxRate: { company: 0.28, trust: 0.33 },
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
  mileageRate: 0.99,
  fbtSingleRate: 0.6393,
  lowValueAssetThreshold: 1000,
  accEarnerLevyRate: 1.75,
  prescribedInterestRate: 0.0827,
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
