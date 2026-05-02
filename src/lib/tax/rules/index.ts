import type { TaxYearConfig } from "./types";
import { taxYear2025 } from "./2025";
import { taxYear2026 } from "./2026";
import { taxYear2027 } from "./2027";

const taxYears: Record<number, TaxYearConfig> = {
  2025: taxYear2025,
  2026: taxYear2026,
  2027: taxYear2027,
};

/**
 * Returns the tax year config for the given date.
 *
 * NZ tax year ends 31 March, so any date from 1 April 2025 to 31 March 2026
 * falls in the 2026 tax year.
 */
export function getTaxYear(date: Date): TaxYearConfig | null {
  const year = getNzTaxYear(date);
  return taxYears[year] ?? null;
}

/**
 * Returns the NZ tax year number for a given date.
 * e.g. February 2026 -> 2026 tax year, May 2026 -> 2027 tax year.
 */
export function getNzTaxYear(date: Date): number {
  const month = date.getMonth(); // 0-indexed (0 = Jan, 2 = Mar)
  const year = date.getFullYear();

  // April onwards (month >= 3) belongs to the next tax year
  if (month >= 3) {
    return year + 1;
  }
  return year;
}

/**
 * Returns the tax year config for a specific tax year number.
 */
export function getTaxYearConfig(year: number): TaxYearConfig {
  const config = taxYears[year];
  if (!config) {
    throw new Error(`No tax year config for ${year}`);
  }
  return config;
}

export type RulesFreshness = "fresh" | "aging" | "stale";

export type TaxRulesStatus = {
  taxYear: number;
  rulesVersion: string | null;
  lastUpdated: string | null;
  lastVerified: string | null;
  freshness: RulesFreshness;
  daysSinceVerified: number | null;
};

export function getTaxRulesStatus(date: Date = new Date()): TaxRulesStatus {
  const config = getTaxYear(date);

  if (!config) {
    return {
      taxYear: getNzTaxYear(date),
      rulesVersion: null,
      lastUpdated: null,
      lastVerified: null,
      freshness: "stale",
      daysSinceVerified: null,
    };
  }

  let daysSinceVerified: number | null = null;
  let freshness: RulesFreshness = "stale";

  if (config.lastVerified) {
    const verifiedDate = new Date(config.lastVerified);
    daysSinceVerified = Math.floor(
      (date.getTime() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceVerified <= 90) freshness = "fresh";
    else if (daysSinceVerified <= 180) freshness = "aging";
    else freshness = "stale";
  }

  return {
    taxYear: config.year,
    rulesVersion: config.rulesVersion ?? null,
    lastUpdated: config.lastUpdated ?? null,
    lastVerified: config.lastVerified ?? null,
    freshness,
    daysSinceVerified,
  };
}

export { type TaxYearConfig } from "./types";
export type {
  TaxBracket,
  EntityType,
  GstFilingPeriod,
  ProvisionalTaxMethod,
  PayeFrequency,
} from "./types";
export { getStandardGstRate } from "./gst-rate";
export {
  prescribedInterestRates,
  getPrescribedInterestRate,
  getPrescribedInterestPeriods,
  type PrescribedInterestPeriod,
  type PrescribedInterestSlice,
} from "./prescribed-interest-rates";
