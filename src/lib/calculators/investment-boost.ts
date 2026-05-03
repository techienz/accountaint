/**
 * Investment Boost (Budget 2025) calculator.
 *
 * 20% upfront deduction on the cost of NEW (or new-to-NZ) depreciable
 * business assets acquired or finished construction on/after 22 May 2025.
 * The remaining 80% depreciates as normal.
 *
 * Eligible: machinery, equipment, work vehicles, NEW commercial/industrial
 * buildings. Excluded: residential buildings, anything previously used in NZ.
 * No minimum value (the $1,000 threshold is the separate low-value
 * asset write-off).
 *
 * Source: https://www.ird.govt.nz/investment-boost — enacted by Taxation
 * (Budget Measures) Act 2025 amending ITA 2007 subpart EE.
 *
 * Per #150, the rate + effective date are sourced exclusively from the
 * per-tax-year config (`getTaxYearConfig(year).investmentBoost`). No
 * inline rate constants — CLAUDE.md: "Tax rules are coded per tax year
 * and versioned. Never hardcode a rate inline." Tests can override via
 * `opts.taxYearLookup`.
 */

import { getNzTaxYear, getTaxYearConfig } from "@/lib/tax/rules";

export type InvestmentBoostAssetInput = {
  description?: string;
  cost: number;
  date: string;
  isNew?: boolean;
  isNewToNz?: boolean;
  isResidentialBuilding?: boolean;
  excludedFromIb?: boolean;
};

export type InvestmentBoostAssetResult = {
  description: string;
  cost: number;
  date: string;
  eligible: boolean;
  ibAmount: number;
  assumesNew: boolean;
  reason?: string;
  /** Tax year the deduction would be claimed in (NZ tax year of purchase). */
  taxYear?: number;
};

export type InvestmentBoostCalculation = {
  effectiveFrom: string;
  rate: number;
  totalIb: number;
  assets: InvestmentBoostAssetResult[];
};

export type InvestmentBoostYearConfig = {
  rate: number;
  effectiveFrom: string;
};

export type InvestmentBoostOptions = {
  /** Per-asset config lookup. Returns null if IB is not configured for
   *  that tax year (e.g. pre-2025 or post-sunset). */
  taxYearLookup?: (year: number) => InvestmentBoostYearConfig | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatHumanDate(iso: string): string {
  // "2025-05-22" → "22 May 2025"
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${d} ${months[m - 1]} ${y}`;
}

function defaultTaxYearLookup(year: number): InvestmentBoostYearConfig | null {
  try {
    return getTaxYearConfig(year).investmentBoost ?? null;
  } catch {
    // Tax year not configured at all (out of supported range).
    return null;
  }
}

function evaluateAsset(
  asset: InvestmentBoostAssetInput,
  opts: InvestmentBoostOptions
): InvestmentBoostAssetResult {
  const description = asset.description ?? "Asset";
  const cost = asset.cost;
  const date = asset.date;
  const newSpecified = asset.isNew !== undefined;
  const assumesNew = !newSpecified && !asset.isNewToNz;

  const taxYear = date ? getNzTaxYear(new Date(date)) : undefined;

  const ineligible = (reason: string): InvestmentBoostAssetResult => ({
    description,
    cost,
    date,
    eligible: false,
    ibAmount: 0,
    assumesNew,
    reason,
    taxYear,
  });

  if (!cost || cost <= 0) {
    return ineligible("No cost recorded");
  }

  const lookup = opts.taxYearLookup ?? defaultTaxYearLookup;
  const yearConfig = taxYear !== undefined ? lookup(taxYear) : null;

  if (!yearConfig) {
    return ineligible(
      `Investment Boost is not configured for tax year ${taxYear ?? "unknown"}`
    );
  }

  if (date < yearConfig.effectiveFrom) {
    return ineligible(
      `Purchased before ${formatHumanDate(yearConfig.effectiveFrom)} (Investment Boost effective date)`
    );
  }
  if (asset.excludedFromIb) {
    return ineligible("Marked as excluded from Investment Boost");
  }
  if (asset.isResidentialBuilding) {
    return ineligible("Residential buildings are excluded from Investment Boost");
  }
  if (asset.isNew === false && !asset.isNewToNz) {
    return ineligible("Asset must be new or new to New Zealand");
  }

  return {
    description,
    cost,
    date,
    eligible: true,
    ibAmount: round2(cost * yearConfig.rate),
    assumesNew,
    taxYear,
  };
}

export function calculateInvestmentBoost(
  assets: InvestmentBoostAssetInput[],
  opts: InvestmentBoostOptions = {}
): InvestmentBoostCalculation {
  const evaluated = assets.map((a) => evaluateAsset(a, opts));
  const totalIb = round2(evaluated.reduce((sum, a) => sum + a.ibAmount, 0));

  // Top-level effectiveFrom/rate are summary fields reflecting the
  // first eligible asset's tax-year config. Per-asset details are the
  // source of truth. Empty / all-ineligible lists fall back to the
  // earliest live config (TY 2026).
  const lookup = opts.taxYearLookup ?? defaultTaxYearLookup;
  const eligibleYear = evaluated.find((a) => a.eligible)?.taxYear;
  const summaryCfg =
    (eligibleYear !== undefined && lookup(eligibleYear)) ||
    lookup(2026) || // earliest live IB year
    { rate: 0, effectiveFrom: "" };

  return {
    effectiveFrom: summaryCfg.effectiveFrom,
    rate: summaryCfg.rate,
    totalIb,
    assets: evaluated,
  };
}
