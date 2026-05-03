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
 * Source: https://www.ird.govt.nz/investment-boost
 */

const EFFECTIVE_FROM = "2025-05-22";
const RATE = 0.2;

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
};

export type InvestmentBoostCalculation = {
  effectiveFrom: string;
  rate: number;
  totalIb: number;
  assets: InvestmentBoostAssetResult[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function evaluateAsset(asset: InvestmentBoostAssetInput): InvestmentBoostAssetResult {
  const description = asset.description ?? "Asset";
  const cost = asset.cost;
  const date = asset.date;
  const newSpecified = asset.isNew !== undefined;
  const assumesNew = !newSpecified && !asset.isNewToNz;

  const ineligible = (reason: string): InvestmentBoostAssetResult => ({
    description,
    cost,
    date,
    eligible: false,
    ibAmount: 0,
    assumesNew,
    reason,
  });

  if (!cost || cost <= 0) {
    return ineligible("No cost recorded");
  }
  if (date < EFFECTIVE_FROM) {
    return ineligible(`Purchased before 22 May 2025 (Investment Boost effective date)`);
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
    ibAmount: round2(cost * RATE),
    assumesNew,
  };
}

export function calculateInvestmentBoost(
  assets: InvestmentBoostAssetInput[]
): InvestmentBoostCalculation {
  const evaluated = assets.map(evaluateAsset);
  const totalIb = round2(evaluated.reduce((sum, a) => sum + a.ibAmount, 0));
  return {
    effectiveFrom: EFFECTIVE_FROM,
    rate: RATE,
    totalIb,
    assets: evaluated,
  };
}
