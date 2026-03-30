import type { TaxYearConfig } from "./types";

/**
 * NZ tax year ending 31 March 2026.
 *
 * Standard provisional tax dates for March balance date entities:
 *   - 28 August 2025 (P1)
 *   - 15 January 2026 (P2)
 *   - 7 May 2026 (P3 — after balance date)
 *
 * AIM provisional tax: due 28th of months 2, 4, 6, 8, 10, 12 of the tax year
 * (i.e. May, Jul, Sep, Nov, Jan, Mar for a March balance date).
 */
export const taxYear2026: TaxYearConfig = {
  year: 2026,
  incomeTaxRate: { company: 0.28, trust: 0.33 },
  gstRate: 0.15,
  provisionalTaxDates: {
    standard: ["08-28", "01-15", "05-07"],
    aim: ["05-28", "07-28", "09-28", "11-28", "01-28", "03-28"],
  },
  personalIncomeTaxBrackets: [
    { threshold: 14000, rate: 0.105 },
    { threshold: 48000, rate: 0.175 },
    { threshold: 70000, rate: 0.30 },
    { threshold: 180000, rate: 0.33 },
    { threshold: Infinity, rate: 0.39 },
  ],
  mileageRate: 0.99,
  fbtSingleRate: 0.6393,
  lowValueAssetThreshold: 1000,
  accEarnerLevyRate: 1.6,
  lastUpdated: "2025-10-01",
  lastVerified: "2026-03-19",
  rulesVersion: "2026.1",
};
