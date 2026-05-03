/**
 * IR10 (Financial Statements Summary) preparation — Investment Boost line.
 *
 * From the **2026 tax year** onwards, the IR10 includes a new line:
 *   "Total value of assets for which Investment Boost is being claimed"
 *
 * IRD requires the **gross asset cost** (not the deduction amount) on the
 * IR10. The deduction itself ($cost × rate) flows through the normal P&L
 * expense line — but we surface both numbers here so the prep page can
 * show what's being filed and what was deducted.
 *
 * Issue: #148. Source: https://www.ird.govt.nz/investment-boost
 */

import { getDb } from "@/lib/db";
import { assets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export type IbAssetRow = {
  id: string;
  name: string;
  cost: number;
  purchase_date: string;
  ib_excluded: boolean;
  ib_claimed_amount: number | null;
  ib_claimed_tax_year: string | null;
};

export type IbAssetSummary = {
  id: string;
  name: string;
  cost: number;
  purchase_date: string;
  ib_amount: number;
};

export type IR10IbData = {
  taxYear: string;
  ibTotalAssetCost: number; // GROSS — the IR10 line value
  ibTotalDeduction: number; // sum of ib_claimed_amount
  ibAssetCount: number;
  ibAssets: IbAssetSummary[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function aggregateIbForIR10(
  rows: IbAssetRow[],
  taxYear: string
): IR10IbData {
  const eligible = rows.filter(
    (r) =>
      !r.ib_excluded &&
      r.ib_claimed_amount !== null &&
      r.ib_claimed_tax_year === taxYear
  );

  const ibTotalAssetCost = round2(
    eligible.reduce((sum, r) => sum + r.cost, 0)
  );
  const ibTotalDeduction = round2(
    eligible.reduce((sum, r) => sum + (r.ib_claimed_amount ?? 0), 0)
  );

  return {
    taxYear,
    ibTotalAssetCost,
    ibTotalDeduction,
    ibAssetCount: eligible.length,
    ibAssets: eligible.map((r) => ({
      id: r.id,
      name: r.name,
      cost: r.cost,
      purchase_date: r.purchase_date,
      ib_amount: r.ib_claimed_amount ?? 0,
    })),
  };
}

export async function prepareIR10(
  businessId: string,
  taxYear: string
): Promise<IR10IbData> {
  const db = getDb();
  const rows = await db
    .select({
      id: assets.id,
      name: assets.name,
      cost: assets.cost,
      purchase_date: assets.purchase_date,
      ib_excluded: assets.ib_excluded,
      ib_claimed_amount: assets.ib_claimed_amount,
      ib_claimed_tax_year: assets.ib_claimed_tax_year,
    })
    .from(assets)
    .where(eq(assets.business_id, businessId));

  return aggregateIbForIR10(rows, taxYear);
}
