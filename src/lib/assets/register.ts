import { getDb } from "@/lib/db";
import { assets, assetDepreciation } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export type AssetWithBookValue = {
  id: string;
  name: string;
  category: string;
  purchase_date: string;
  cost: number;
  depreciation_method: string;
  depreciation_rate: number;
  is_low_value: boolean;
  disposed: boolean;
  disposal_date: string | null;
  disposal_price: number | null;
  notes: string | null;
  currentBookValue: number;
};

export async function listAssets(businessId: string): Promise<AssetWithBookValue[]> {
  const db = getDb();

  const assetRows = await db
    .select()
    .from(assets)
    .where(eq(assets.business_id, businessId))
    .orderBy(desc(assets.created_at));

  const result: AssetWithBookValue[] = [];

  for (const asset of assetRows) {
    // Get latest depreciation record for current book value
    const [latestDep] = await db
      .select()
      .from(assetDepreciation)
      .where(eq(assetDepreciation.asset_id, asset.id))
      .orderBy(desc(assetDepreciation.tax_year))
      .limit(1);

    const currentBookValue = latestDep
      ? latestDep.closing_book_value
      : asset.cost;

    result.push({
      id: asset.id,
      name: asset.name,
      category: asset.category,
      purchase_date: asset.purchase_date,
      cost: asset.cost,
      depreciation_method: asset.depreciation_method,
      depreciation_rate: asset.depreciation_rate,
      is_low_value: asset.is_low_value,
      disposed: asset.disposed,
      disposal_date: asset.disposal_date,
      disposal_price: asset.disposal_price,
      notes: asset.notes,
      currentBookValue,
    });
  }

  return result;
}
