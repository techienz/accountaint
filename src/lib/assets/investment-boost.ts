/**
 * Server-side helper: recompute the persisted Investment Boost fields
 * (`ib_claimed_amount`, `ib_claimed_tax_year`) for a single asset.
 *
 * Called whenever an asset row is created or updated so the stored claim
 * stays in sync with the user's classification of the asset.
 *
 * Schema fields use a 3-state nullable boolean for `is_new` and
 * `is_new_to_nz`: null means "Don't know" — never silently treated as
 * eligible (per #148 issue body). The calculator surfaces these as
 * ineligible with `assumesNew=true` so the optimiser can prompt the user.
 *
 * Issue: #148. Calculator: src/lib/calculators/investment-boost.ts.
 */

import { calculateInvestmentBoost } from "@/lib/calculators/investment-boost";

export type AssetIbInput = {
  name: string;
  cost: number;
  purchase_date: string;
  is_new: boolean | null;
  is_new_to_nz: boolean | null;
  ib_excluded: boolean;
};

export type AssetIbResult = {
  ib_claimed_amount: number | null;
  ib_claimed_tax_year: string | null;
  eligible: boolean;
  reason?: string;
};

/**
 * UI-side classification choice. The form posts this as a string; the
 * server maps it to the (is_new, is_new_to_nz) tuple via parseNewClassification.
 *
 * - "yes"        → is_new=true,  is_new_to_nz=null  (eligible if other rules pass)
 * - "no"         → is_new=false, is_new_to_nz=false (ineligible — used in NZ)
 * - "new-to-nz"  → is_new=false, is_new_to_nz=true  (eligible — imported, never used in NZ)
 * - "dont-know"  → is_new=null,  is_new_to_nz=null  (ineligible — not silently assumed)
 */
export type NewClassification = "yes" | "no" | "new-to-nz" | "dont-know";

export function parseNewClassification(
  value: unknown
): { is_new: boolean | null; is_new_to_nz: boolean | null } {
  switch (value) {
    case "yes":
      return { is_new: true, is_new_to_nz: null };
    case "no":
      return { is_new: false, is_new_to_nz: false };
    case "new-to-nz":
      return { is_new: false, is_new_to_nz: true };
    case "dont-know":
    case "":
    case null:
    case undefined:
      return { is_new: null, is_new_to_nz: null };
    default:
      // Unknown value — treat as "Don't know" to avoid silently assuming.
      return { is_new: null, is_new_to_nz: null };
  }
}

export function recomputeAssetIb(asset: AssetIbInput): AssetIbResult {
  // Server policy (#148, stricter than calculator's Phase 1 default):
  // never silently assume eligibility. If the user hasn't classified
  // is_new (and the asset isn't flagged as new-to-NZ either), treat as
  // not-yet-claimed regardless of what the math would say.
  const unclassified =
    asset.is_new === null && asset.is_new_to_nz === null && !asset.ib_excluded;
  if (unclassified) {
    return {
      ib_claimed_amount: null,
      ib_claimed_tax_year: null,
      eligible: false,
      reason:
        "Not yet classified — confirm whether this asset is NEW (or new to NZ) before claiming Investment Boost",
    };
  }

  const calc = calculateInvestmentBoost([
    {
      description: asset.name,
      cost: asset.cost,
      date: asset.purchase_date,
      isNew: asset.is_new ?? undefined,
      isNewToNz: asset.is_new_to_nz ?? undefined,
      excludedFromIb: asset.ib_excluded,
    },
  ]);

  const result = calc.assets[0];
  if (!result.eligible) {
    return {
      ib_claimed_amount: null,
      ib_claimed_tax_year: null,
      eligible: false,
      reason: result.reason,
    };
  }
  return {
    ib_claimed_amount: result.ibAmount,
    ib_claimed_tax_year: result.taxYear !== undefined ? String(result.taxYear) : null,
    eligible: true,
  };
}
