import type { FuelType, KilometreRateConfig } from "@/lib/tax/rules/types";

export type ActualCosts = {
  fuel: number;
  insurance: number;
  rego: number;
  maintenance: number;
  depreciation: number;
};

export type Regime = "self_employed" | "employee_reimbursement";

export type MileageBreakdownItem = {
  item: string;
  amount: number;
};

export type VehicleClaimResult = {
  method: string;
  totalClaim: number;
  /** Tier 1 / Tier 2 split details when method = "mileage_rate". */
  mileageDetail?: {
    fuelType: FuelType;
    totalVehicleKm: number;
    totalBusinessKm: number;
    businessProportion: number;
    tier1BusinessKm: number;
    tier2BusinessKm: number;
    tier1Rate: number;
    tier2Rate: number;
    tier1Claim: number;
    tier2Claim: number;
    capUsedKm: number;
    regime: Regime;
    notes: string[];
  };
  breakdown: MileageBreakdownItem[];
};

export type VehicleClaimInput = {
  method: "mileage_rate" | "actual_cost";

  /** Required for mileage_rate. Total km the vehicle did in the income
   *  year (business + private). Drives the tier-1 cap. */
  totalVehicleKm?: number;

  /** Required for both methods. Business kilometres in the income year. */
  totalBusinessKm: number;

  /** Required for both methods. 0–100. */
  businessUsePercentage: number;

  /** Required for mileage_rate. */
  fuelType?: FuelType;

  /** Required for mileage_rate. Pulled from getTaxYearConfig(year). */
  kilometreRates?: KilometreRateConfig;

  /** Required for actual_cost. */
  actualCosts?: ActualCosts | null;

  /**
   * Self-employed (OS 19/04a) or employee reimbursement (OS 19/04b).
   * Defaults to self_employed for backward compat.
   */
  regime?: Regime;

  /**
   * Required only for employee_reimbursement: when false, Tier 1 is
   * limited to noLogbookTier1CapKm (3,500 business km currently)
   * regardless of total vehicle km.
   */
  hasLogbook?: boolean;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * IRD kilometre-rate (mileage) deduction with tier 1/2 split.
 * Audit #72.
 *
 * Rules implemented:
 *  - Tier 1 cap is on TOTAL vehicle km (business + private).
 *  - Business proportion applied AFTER the tier split.
 *  - Employee-reimbursement-without-logbook: Tier 1 capped at
 *    noLogbookTier1CapKm BUSINESS km (different from total-km cap).
 *  - Self-employed always assumed to have a logbook (legally required
 *    to use this method); hasLogbook arg ignored for that regime.
 */
export function calculateMileageClaim(input: {
  fuelType: FuelType;
  totalVehicleKm: number;
  totalBusinessKm: number;
  kilometreRates: KilometreRateConfig;
  regime?: Regime;
  hasLogbook?: boolean;
}): VehicleClaimResult {
  const fuel = input.fuelType;
  const totalKm = Math.max(0, input.totalVehicleKm);
  const businessKm = Math.max(0, Math.min(input.totalBusinessKm, totalKm));
  const regime = input.regime ?? "self_employed";
  const businessProportion = totalKm > 0 ? businessKm / totalKm : 0;
  const rates = input.kilometreRates.rates[fuel];
  const notes: string[] = [];

  let tier1BusinessKm: number;
  let tier2BusinessKm: number;
  let capUsedKm: number;

  if (regime === "employee_reimbursement" && input.hasLogbook === false) {
    // OS 19/04b safe harbour — Tier 1 limited to first 3,500 BUSINESS km.
    capUsedKm = input.kilometreRates.noLogbookTier1CapKm;
    tier1BusinessKm = Math.min(businessKm, capUsedKm);
    tier2BusinessKm = Math.max(0, businessKm - capUsedKm);
    notes.push(
      `Employee reimbursement without logbook: Tier 1 capped at ${capUsedKm.toLocaleString()} business km (OS 19/04b).`,
    );
  } else {
    // OS 19/04a (self-employed) or OS 19/04b WITH logbook: Tier 1 cap
    // is on TOTAL vehicle km. Apply the business proportion after the split.
    capUsedKm = input.kilometreRates.tier1CapKm;
    const tier1TotalKm = Math.min(totalKm, capUsedKm);
    const tier2TotalKm = Math.max(0, totalKm - capUsedKm);
    tier1BusinessKm = tier1TotalKm * businessProportion;
    tier2BusinessKm = tier2TotalKm * businessProportion;
    if (regime === "self_employed") {
      notes.push("Self-employed: a vehicle logbook (or 90-day test period) is legally required to use this method.");
    }
  }

  const tier1Claim = round2(tier1BusinessKm * rates.tier1);
  const tier2Claim = round2(tier2BusinessKm * rates.tier2);
  const totalClaim = round2(tier1Claim + tier2Claim);

  return {
    method: "mileage_rate",
    totalClaim,
    mileageDetail: {
      fuelType: fuel,
      totalVehicleKm: totalKm,
      totalBusinessKm: businessKm,
      businessProportion: round2(businessProportion * 100) / 100,
      tier1BusinessKm: round2(tier1BusinessKm),
      tier2BusinessKm: round2(tier2BusinessKm),
      tier1Rate: rates.tier1,
      tier2Rate: rates.tier2,
      tier1Claim,
      tier2Claim,
      capUsedKm,
      regime,
      notes,
    },
    breakdown: [
      {
        item: `Tier 1: ${round2(tier1BusinessKm).toLocaleString()} business km @ $${rates.tier1.toFixed(2)}/km`,
        amount: tier1Claim,
      },
      ...(tier2BusinessKm > 0
        ? [{
            item: `Tier 2: ${round2(tier2BusinessKm).toLocaleString()} business km @ $${rates.tier2.toFixed(2)}/km`,
            amount: tier2Claim,
          }]
        : []),
    ],
  };
}

/**
 * Backward-compatible wrapper for the original signature. Existing
 * callers pass `mileageRate` (a single $/km) and `totalBusinessKm`. We
 * approximate the right answer by treating it as petrol Tier 1 with the
 * business km doubling as total km (i.e. assuming 100% business use).
 *
 * New callers should pass a `VehicleClaimInput` object via
 * `calculateVehicleClaim2()` for full tier accuracy.
 */
export function calculateVehicleClaim(
  method: "mileage_rate" | "actual_cost",
  totalBusinessKm: number,
  mileageRate: number,
  actualCosts: ActualCosts | null,
  businessUsePercentage: number,
): VehicleClaimResult {
  if (method === "mileage_rate") {
    // Legacy path — single rate × km. Wrong if total vehicle km exceeds
    // 14,000 / business use < 100%. Callers should migrate to the
    // full-input variant. Audit #72.
    const claim = round2(totalBusinessKm * mileageRate);
    return {
      method,
      totalClaim: claim,
      breakdown: [
        {
          item: `${totalBusinessKm.toLocaleString()} km @ $${mileageRate}/km (legacy single-rate; tier split not applied)`,
          amount: claim,
        },
      ],
    };
  }

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
      amount: round2(i.amount * pct),
    }));

  const totalClaim = round2(breakdown.reduce((sum, b) => sum + b.amount, 0));

  return {
    method,
    totalClaim,
    breakdown,
  };
}
