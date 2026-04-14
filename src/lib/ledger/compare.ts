import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getLedgerPLTotals } from "./reports/profit-loss";
import { generateBalanceSheet } from "./reports/balance-sheet";
import { extractTotals } from "@/lib/reports/parsers";

export type ComparisonResult = {
  ledger: { revenue: number; expenses: number; netProfit: number } | null;
  xero: { revenue: number; expenses: number; netProfit: number } | null;
  variances: {
    revenue: number;
    expenses: number;
    netProfit: number;
  } | null;
  isAligned: boolean;
  period: { from: string; to: string };
};

export type BalanceSheetComparisonResult = {
  ledger: { totalAssets: number; totalLiabilitiesAndEquity: number } | null;
  xero: { totalAssets: number; totalLiabilitiesAndEquity: number } | null;
  variances: {
    totalAssets: number;
    totalLiabilitiesAndEquity: number;
  } | null;
  isAligned: boolean;
  asAt: string;
};

/**
 * Compare P&L from the local ledger with Xero's cached P&L.
 * Returns side-by-side totals and variances.
 */
export function compareWithXero(
  businessId: string,
  from: string,
  to: string
): ComparisonResult {
  const ledger = getLedgerPLTotals(businessId, from, to);
  const xero = getXeroPLTotals(businessId);

  const hasLedger = ledger !== null;
  const hasXero = xero !== null;

  if (!hasLedger && !hasXero) {
    return {
      ledger: null,
      xero: null,
      variances: null,
      isAligned: false,
      period: { from, to },
    };
  }

  const variances =
    hasLedger && hasXero
      ? {
          revenue: Math.round((ledger.revenue - xero.revenue) * 100) / 100,
          expenses: Math.round((ledger.expenses - xero.expenses) * 100) / 100,
          netProfit:
            Math.round((ledger.netProfit - xero.netProfit) * 100) / 100,
        }
      : null;

  const isAligned = variances
    ? Math.abs(variances.revenue) < 1 &&
      Math.abs(variances.expenses) < 1 &&
      Math.abs(variances.netProfit) < 1
    : false;

  return {
    ledger,
    xero,
    variances,
    isAligned,
    period: { from, to },
  };
}

/**
 * Compare balance sheet from the local ledger with Xero's cached balance sheet.
 */
export function compareBalanceSheet(
  businessId: string,
  asAt: string
): BalanceSheetComparisonResult {
  // Get ledger balance sheet
  let ledgerData: {
    totalAssets: number;
    totalLiabilitiesAndEquity: number;
  } | null = null;

  try {
    const bs = generateBalanceSheet(businessId, asAt);
    if (bs.assets.accounts.length > 0 || bs.liabilities.accounts.length > 0) {
      ledgerData = {
        totalAssets: bs.totalAssets,
        totalLiabilitiesAndEquity: bs.totalLiabilitiesAndEquity,
      };
    }
  } catch {
    // No ledger data available
  }

  // Get Xero balance sheet from cache
  const xeroData = getXeroBSTotals(businessId);

  const hasLedger = ledgerData !== null;
  const hasXero = xeroData !== null;

  if (!hasLedger && !hasXero) {
    return {
      ledger: null,
      xero: null,
      variances: null,
      isAligned: false,
      asAt,
    };
  }

  const variances =
    hasLedger && hasXero
      ? {
          totalAssets:
            Math.round(
              (ledgerData!.totalAssets - xeroData!.totalAssets) * 100
            ) / 100,
          totalLiabilitiesAndEquity:
            Math.round(
              (ledgerData!.totalLiabilitiesAndEquity -
                xeroData!.totalLiabilitiesAndEquity) *
                100
            ) / 100,
        }
      : null;

  const isAligned = variances
    ? Math.abs(variances.totalAssets) < 1 &&
      Math.abs(variances.totalLiabilitiesAndEquity) < 1
    : false;

  return {
    ledger: ledgerData,
    xero: xeroData,
    variances,
    isAligned,
    asAt,
  };
}

/**
 * Read P&L totals from Xero cache.
 */
function getXeroPLTotals(
  businessId: string
): { revenue: number; expenses: number; netProfit: number } | null {
  const db = getDb();
  const cache = db
    .select()
    .from(schema.xeroCache)
    .where(
      and(
        eq(schema.xeroCache.business_id, businessId),
        eq(schema.xeroCache.entity_type, "profit_loss")
      )
    )
    .get();

  if (!cache?.data) return null;

  try {
    const data = JSON.parse(cache.data);
    return extractTotals(data);
  } catch {
    return null;
  }
}

/**
 * Read balance sheet totals from Xero cache.
 */
function getXeroBSTotals(
  businessId: string
): { totalAssets: number; totalLiabilitiesAndEquity: number } | null {
  const db = getDb();
  const cache = db
    .select()
    .from(schema.xeroCache)
    .where(
      and(
        eq(schema.xeroCache.business_id, businessId),
        eq(schema.xeroCache.entity_type, "balance_sheet")
      )
    )
    .get();

  if (!cache?.data) return null;

  try {
    const data = JSON.parse(cache.data);
    const report = data?.Reports?.[0];
    if (!report?.Rows) return null;

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    for (const section of report.Rows) {
      if (section.RowType !== "Section") continue;
      const title = (section.Title || "").toLowerCase();
      const summaryRow = section.Rows?.find(
        (r: { RowType: string }) => r.RowType === "SummaryRow"
      );
      const value = parseFloat(summaryRow?.Cells?.[1]?.Value || "0");

      if (title.includes("asset")) {
        totalAssets = value;
      } else if (title.includes("liabilit")) {
        totalLiabilities = value;
      } else if (title.includes("equity")) {
        totalEquity = value;
      }
    }

    return {
      totalAssets,
      totalLiabilitiesAndEquity:
        Math.round((totalLiabilities + totalEquity) * 100) / 100,
    };
  } catch {
    return null;
  }
}
