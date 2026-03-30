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
};

export function calculateHomeOffice(
  method: "proportional" | "sqm_rate",
  officeAreaSqm: number,
  totalAreaSqm: number,
  costs: HomeOfficeCosts
): HomeOfficeResult {
  const proportion = totalAreaSqm > 0 ? officeAreaSqm / totalAreaSqm : 0;

  const costItems = [
    { item: "Rates", cost: costs.rates },
    { item: "Insurance", cost: costs.insurance },
    { item: "Mortgage Interest", cost: costs.mortgage_interest },
    { item: "Rent", cost: costs.rent },
    { item: "Power", cost: costs.power },
    { item: "Internet", cost: costs.internet },
  ];

  const totalCosts = costItems.reduce((sum, c) => sum + c.cost, 0);

  const breakdown = costItems
    .filter((c) => c.cost > 0)
    .map((c) => ({
      item: c.item,
      cost: c.cost,
      claim: Math.round(c.cost * proportion * 100) / 100,
    }));

  const totalClaim = breakdown.reduce((sum, b) => sum + b.claim, 0);

  return {
    method,
    proportion: Math.round(proportion * 10000) / 10000,
    totalCosts,
    totalClaim: Math.round(totalClaim * 100) / 100,
    breakdown,
  };
}
