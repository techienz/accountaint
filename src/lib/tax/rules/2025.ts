import type { TaxYearConfig } from "./types";

/**
 * NZ tax year ending 31 March 2025.
 *
 * Standard provisional tax dates for March balance date entities:
 *   - 28 August 2024 (P1)
 *   - 15 January 2025 (P2)
 *   - 7 May 2025 (P3 — after balance date)
 *
 * Important note on personal income tax brackets: NZ changed brackets
 * mid-year on 31 July 2024. IRD publishes "composite annual" effective
 * rates that smooth the transition (e.g. 12.82% effective on the
 * $14,000-$15,600 band). We use the SIMPLIFIED post-31-July bracket
 * shape here for code consistency with 2026/2027 — the IRD assessment
 * uses the composite values when filing. This means PAYE-during-the-year
 * may show small differences vs the final IR3 assessment for the 2025
 * year specifically. Users filing for 2025 should rely on IR3 prep, not
 * the in-year PAYE numbers, for the final liability.
 *
 * Audit #84.
 */
export const taxYear2025: TaxYearConfig = {
  year: 2025,
  // Trustee tax rate: 39% from 1 April 2024 (Trustee Tax Rate Increase
  // Act 2024). 2025 is the first year this applies.
  incomeTaxRate: { company: 0.28, trust: 0.39 },
  gstRate: 0.15,
  provisionalTaxDates: {
    standard: ["08-28", "01-15", "05-07"],
    aim: ["05-28", "07-28", "09-28", "11-28", "01-28", "03-28"],
  },
  personalIncomeTaxBrackets: [
    // Post-31-July-2024 thresholds. See module-level note about composite
    // brackets for the 2025-only mid-year change.
    { threshold: 15600, rate: 0.105 },
    { threshold: 53500, rate: 0.175 },
    { threshold: 78100, rate: 0.30 },
    { threshold: 180000, rate: 0.33 },
    { threshold: Infinity, rate: 0.39 },
  ],
  // Single-rate fallback retained for backward compatibility. Equals the
  // petrol Tier 1 rate (which is what IRD published as headline pre-tier
  // structure). Audit #72.
  mileageRate: 1.17,
  kilometreRates: {
    tier1CapKm: 14000,
    noLogbookTier1CapKm: 3500,
    sourceOperationalStatement: "OS 19/04-KM-2025",
    rates: {
      petrol:        { tier1: 1.17, tier2: 0.37 },
      diesel:        { tier1: 1.26, tier2: 0.35 },
      petrol_hybrid: { tier1: 0.86, tier2: 0.21 },
      electric:      { tier1: 1.08, tier2: 0.19 },
    },
  },
  fbtSingleRate: 0.6393,
  // IRD square-metre rate for home office (OS 19/03 CPI 2025). Audit #86.
  homeOfficeSqmRate: 55.60,
  lowValueAssetThreshold: 1000,
  // ACC earner levy rate + cap effective for 2025 (1 Apr 2024 - 31 Mar 2025).
  accEarnerLevyRate: 1.60,
  accEarnerLevyCap: 142283,
  // NOTE: prescribed interest rate moved out of TaxYearConfig (audit #77).
  // See src/lib/tax/rules/prescribed-interest-rates.ts. For 2025, the
  // entire year was at 8.41% (carryover from 1 Oct 2023 OIC).
  // Minimum Wage Order 2024 (SL 2024/16) — effective 1 April 2024.
  minimumWage: 23.15,
  minimumWageStartingOut: 18.52,
  kiwisaverMinEmployerRate: 0.03,
  kiwisaverDefaultEmployeeRate: 0.03,
  studentLoanRepaymentRate: 0.12,
  studentLoanRepaymentThreshold: 24128,
  // ESCT brackets effective for 2025 (pre-1-April-2025 change).
  esctBrackets: [
    { threshold: 16800, rate: 0.105 },
    { threshold: 57600, rate: 0.175 },
    { threshold: 84000, rate: 0.30 },
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
  lastUpdated: "2026-05-02",
  lastVerified: "2026-05-02",
  rulesVersion: "2025.1",
};
