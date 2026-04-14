import { getDb } from "@/lib/db";
import { assets, assetDepreciation } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { calculateAnnualDepreciation } from "@/lib/tax/depreciation";
import { postDepreciationJournal } from "@/lib/ledger/post";

export type DepreciationRunResult = {
  assetsProcessed: number;
  totalDepreciation: number;
  results: {
    assetId: string;
    assetName: string;
    openingBookValue: number;
    depreciationAmount: number;
    closingBookValue: number;
  }[];
};

/**
 * Run annual depreciation for all active (non-disposed) assets.
 * Calculates months owned in the tax year and writes depreciation records.
 */
export async function runAnnualDepreciation(
  businessId: string,
  taxYear: string
): Promise<DepreciationRunResult> {
  const db = getDb();
  const year = Number(taxYear);

  // Tax year runs April (year-1) to March (year)
  const taxYearStart = new Date(year - 1, 3, 1); // April 1
  const taxYearEnd = new Date(year, 2, 31); // March 31

  const assetRows = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.business_id, businessId),
        eq(assets.disposed, false)
      )
    );

  const results: DepreciationRunResult["results"] = [];
  let totalDepreciation = 0;

  for (const asset of assetRows) {
    // Skip low-value assets (already fully expensed in purchase year)
    if (asset.is_low_value) continue;

    // Calculate months owned in this tax year
    const purchaseDate = new Date(asset.purchase_date);
    const effectiveStart = purchaseDate > taxYearStart ? purchaseDate : taxYearStart;

    if (effectiveStart > taxYearEnd) continue; // Not yet owned in this tax year

    const monthsOwned = Math.ceil(
      (taxYearEnd.getTime() - effectiveStart.getTime()) /
        (1000 * 60 * 60 * 24 * 30.44)
    );

    // Get opening book value from previous year's closing, or cost if first year
    const [prevDep] = await db
      .select()
      .from(assetDepreciation)
      .where(
        and(
          eq(assetDepreciation.asset_id, asset.id),
          eq(assetDepreciation.tax_year, String(year - 1))
        )
      );

    const openingBookValue = prevDep ? prevDep.closing_book_value : asset.cost;

    if (openingBookValue <= 0) continue;

    const dep = calculateAnnualDepreciation(
      asset.cost,
      openingBookValue,
      asset.depreciation_method as "DV" | "SL",
      asset.depreciation_rate,
      Math.min(monthsOwned, 12)
    );

    // Delete existing record for this year if re-running
    const [existingDep] = await db
      .select()
      .from(assetDepreciation)
      .where(
        and(
          eq(assetDepreciation.asset_id, asset.id),
          eq(assetDepreciation.tax_year, taxYear)
        )
      );

    if (existingDep) {
      await db
        .delete(assetDepreciation)
        .where(eq(assetDepreciation.id, existingDep.id));
    }

    await db.insert(assetDepreciation).values({
      id: crypto.randomUUID(),
      asset_id: asset.id,
      business_id: businessId,
      tax_year: taxYear,
      opening_book_value: openingBookValue,
      depreciation_amount: dep.depreciationAmount,
      closing_book_value: dep.closingBookValue,
    });

    // Post journal entry for depreciation
    const depRecordId = existingDep?.id ?? crypto.randomUUID();
    try {
      postDepreciationJournal(businessId, {
        id: depRecordId,
        tax_year: taxYear,
        depreciation_amount: dep.depreciationAmount,
        asset_name: asset.name,
      });
    } catch (e) {
      console.error("[ledger] Failed to post depreciation journal:", e);
    }

    results.push({
      assetId: asset.id,
      assetName: asset.name,
      openingBookValue,
      depreciationAmount: dep.depreciationAmount,
      closingBookValue: dep.closingBookValue,
    });

    totalDepreciation += dep.depreciationAmount;
  }

  return {
    assetsProcessed: results.length,
    totalDepreciation: Math.round(totalDepreciation * 100) / 100,
    results,
  };
}
