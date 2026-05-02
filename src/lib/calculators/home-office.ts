import { getTaxYearConfig } from "@/lib/tax/rules";

export type HomeOfficeCosts = {
  rates: number;
  insurance: number;
  mortgage_interest: number;
  rent: number;
  power: number;
  internet: number;
};

export type HomeOfficeResult = {
  method: string;
  proportion: number;
  totalCosts: number;
  totalClaim: number;
  breakdown: { item: string; cost: number; claim: number }[];
  /** Filled when method = "sqm_rate" — the per-m² flat portion. */
  sqmRateDetail?: {
    sqmRate: number;
    officeAreaSqm: number;
    flatPortionClaim: number;
    sourceOperationalStatement: string;
  };
};

/**
 * Two methods:
 *
 * 1. "proportional" — the office area / total area ratio is applied to
 *    EVERY listed cost (rates, insurance, mortgage interest, rent,
 *    power, internet). The simplest method but requires keeping all
 *    receipts.
 *
 * 2. "sqm_rate" — IRD's flat-rate alternative (OS 19/03). The office
 *    area in m² is multiplied by an IRD-published per-m² rate which
 *    covers utilities, telecommunications, repairs/maintenance, and
 *    depreciation of household items. The PREMISES costs (rates,
 *    insurance, mortgage interest, rent) still need to be itemised
 *    and prorated by the office/total area ratio. The flat rate
 *    REPLACES the prorating of power and internet only.
 *
 *    Audit #86: the previous code accepted `method` but never branched
 *    on it — both methods returned identical results, and "sqm_rate"
 *    silently produced wrong (low) numbers because it didn't apply the
 *    flat per-m² portion at all.
 */
export function calculateHomeOffice(
  method: "proportional" | "sqm_rate",
  officeAreaSqm: number,
  totalAreaSqm: number,
  costs: HomeOfficeCosts,
  taxYear?: number,
): HomeOfficeResult {
  const proportion = totalAreaSqm > 0 ? officeAreaSqm / totalAreaSqm : 0;

  if (method === "sqm_rate") {
    // taxYear required for the IRD per-m² lookup. Fall back to current
    // tax year if not supplied (preserves backward compat).
    const year = taxYear ?? currentNzTaxYear();
    const config = getTaxYearConfig(year);
    const sqmRate = config.homeOfficeSqmRate;

    // Flat portion: covers utilities + telco + repairs + minor depreciation.
    const flatPortionClaim = round2(officeAreaSqm * sqmRate);

    // Premises costs still itemised + prorated. Power and internet
    // explicitly EXCLUDED from prorating because the flat rate covers them.
    const premisesItems = [
      { item: "Rates",             cost: costs.rates },
      { item: "Insurance",         cost: costs.insurance },
      { item: "Mortgage Interest", cost: costs.mortgage_interest },
      { item: "Rent",              cost: costs.rent },
    ];
    const premisesBreakdown = premisesItems
      .filter((c) => c.cost > 0)
      .map((c) => ({
        item: c.item,
        cost: c.cost,
        claim: round2(c.cost * proportion),
      }));
    const premisesClaim = premisesBreakdown.reduce((s, b) => s + b.claim, 0);

    // Total cost displayed: premises costs only (the flat rate isn't a
    // "cost" the user paid, it's a deemed deduction).
    const totalCosts = premisesItems.reduce((s, c) => s + c.cost, 0);

    return {
      method,
      proportion: round4(proportion),
      totalCosts,
      totalClaim: round2(flatPortionClaim + premisesClaim),
      breakdown: [
        ...premisesBreakdown,
        {
          item: `Utilities + telco (flat rate: ${officeAreaSqm} m² × $${sqmRate.toFixed(2)}/m²)`,
          cost: 0,
          claim: flatPortionClaim,
        },
      ],
      sqmRateDetail: {
        sqmRate,
        officeAreaSqm,
        flatPortionClaim,
        sourceOperationalStatement: "OS 19/03 (CPI-adjusted annually)",
      },
    };
  }

  // Proportional method — apply the area ratio to every listed cost.
  const allItems = [
    { item: "Rates",             cost: costs.rates },
    { item: "Insurance",         cost: costs.insurance },
    { item: "Mortgage Interest", cost: costs.mortgage_interest },
    { item: "Rent",              cost: costs.rent },
    { item: "Power",             cost: costs.power },
    { item: "Internet",          cost: costs.internet },
  ];
  const totalCosts = allItems.reduce((s, c) => s + c.cost, 0);
  const breakdown = allItems
    .filter((c) => c.cost > 0)
    .map((c) => ({
      item: c.item,
      cost: c.cost,
      claim: round2(c.cost * proportion),
    }));
  const totalClaim = breakdown.reduce((s, b) => s + b.claim, 0);

  return {
    method,
    proportion: round4(proportion),
    totalCosts,
    totalClaim: round2(totalClaim),
    breakdown,
  };
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
function round4(n: number): number { return Math.round(n * 10000) / 10000; }

function currentNzTaxYear(): number {
  const d = new Date();
  return d.getMonth() >= 3 ? d.getFullYear() + 1 : d.getFullYear();
}
