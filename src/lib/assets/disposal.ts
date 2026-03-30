import { getDb } from "@/lib/db";
import { assets, assetDepreciation } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { calculateDisposal } from "@/lib/tax/depreciation";
import { getNzTaxYear } from "@/lib/tax/rules";

export type DisposalResult = {
  depreciationRecovered: number;
  lossOnSale: number;
};

export async function disposeAsset(
  assetId: string,
  businessId: string,
  salePrice: number,
  disposalDate: string
): Promise<DisposalResult> {
  const db = getDb();

  // Get the asset
  const [asset] = await db
    .select()
    .from(assets)
    .where(
      and(eq(assets.id, assetId), eq(assets.business_id, businessId))
    );

  if (!asset) throw new Error("Asset not found");
  if (asset.disposed) throw new Error("Asset already disposed");

  // Get current book value
  const [latestDep] = await db
    .select()
    .from(assetDepreciation)
    .where(eq(assetDepreciation.asset_id, assetId))
    .orderBy(desc(assetDepreciation.tax_year))
    .limit(1);

  const bookValue = latestDep ? latestDep.closing_book_value : asset.cost;

  const result = calculateDisposal(asset.cost, bookValue, salePrice);

  // Mark asset as disposed
  await db
    .update(assets)
    .set({
      disposed: true,
      disposal_date: disposalDate,
      disposal_price: salePrice,
      updated_at: new Date(),
    })
    .where(eq(assets.id, assetId));

  // Record the disposal in depreciation table
  const taxYear = String(getNzTaxYear(new Date(disposalDate)));
  await db.insert(assetDepreciation).values({
    id: crypto.randomUUID(),
    asset_id: assetId,
    business_id: businessId,
    tax_year: taxYear,
    opening_book_value: bookValue,
    depreciation_amount: 0,
    closing_book_value: 0,
    depreciation_recovered: result.depreciationRecovered,
    loss_on_sale: result.lossOnSale,
  });

  return result;
}
