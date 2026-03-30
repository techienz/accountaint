export type ActualCosts = {
  fuel: number;
  insurance: number;
  rego: number;
  maintenance: number;
  depreciation: number;
};

export type VehicleClaimResult = {
  method: string;
  totalClaim: number;
  breakdown: { item: string; amount: number }[];
};

export function calculateVehicleClaim(
  method: "mileage_rate" | "actual_cost",
  totalBusinessKm: number,
  mileageRate: number,
  actualCosts: ActualCosts | null,
  businessUsePercentage: number
): VehicleClaimResult {
  if (method === "mileage_rate") {
    const claim = Math.round(totalBusinessKm * mileageRate * 100) / 100;
    return {
      method,
      totalClaim: claim,
      breakdown: [
        {
          item: `${totalBusinessKm.toLocaleString()} km @ $${mileageRate}/km`,
          amount: claim,
        },
      ],
    };
  }

  // Actual cost method
  if (!actualCosts) {
    return { method, totalClaim: 0, breakdown: [] };
  }

  const pct = businessUsePercentage / 100;
  const items = [
    { item: "Fuel", amount: actualCosts.fuel },
    { item: "Insurance", amount: actualCosts.insurance },
    { item: "Registration", amount: actualCosts.rego },
    { item: "Maintenance", amount: actualCosts.maintenance },
    { item: "Depreciation", amount: actualCosts.depreciation },
  ];

  const breakdown = items
    .filter((i) => i.amount > 0)
    .map((i) => ({
      item: i.item,
      amount: Math.round(i.amount * pct * 100) / 100,
    }));

  const totalClaim = breakdown.reduce((sum, b) => sum + b.amount, 0);

  return {
    method,
    totalClaim: Math.round(totalClaim * 100) / 100,
    breakdown,
  };
}
