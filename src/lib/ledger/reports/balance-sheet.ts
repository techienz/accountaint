import { getTrialBalance } from "../journals";
import { getLedgerPLTotals } from "./profit-loss";

export type BalanceSheetSection = {
  title: string;
  accounts: Array<{ code: string; name: string; amount: number }>;
  total: number;
};

export type BalanceSheetReport = {
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  asAt: string;
};

/**
 * Generate a balance sheet from journal entries.
 * Uses all journal entries up to the given date (cumulative).
 * Current year earnings derived from P&L for the fiscal year containing the date.
 */
export function generateBalanceSheet(
  businessId: string,
  asAt: string
): BalanceSheetReport {
  // Get cumulative balances from the beginning of time to asAt
  const rows = getTrialBalance(businessId, { to: asAt });

  // Assets: debit balance = positive
  const assetAccounts = rows
    .filter((r) => r.type === "asset")
    .map((r) => ({
      code: r.code,
      name: r.name,
      amount: Math.round((r.debit - r.credit) * 100) / 100,
    }))
    .filter((a) => a.amount !== 0);

  // Liabilities: credit balance = positive
  const liabilityAccounts = rows
    .filter((r) => r.type === "liability")
    .map((r) => ({
      code: r.code,
      name: r.name,
      amount: Math.round((r.credit - r.debit) * 100) / 100,
    }))
    .filter((a) => a.amount !== 0);

  // Equity accounts: credit balance = positive
  const equityAccounts = rows
    .filter((r) => r.type === "equity")
    .map((r) => ({
      code: r.code,
      name: r.name,
      amount: Math.round((r.credit - r.debit) * 100) / 100,
    }))
    .filter((a) => a.amount !== 0);

  // Calculate current year earnings from revenue - expenses
  // Determine fiscal year (NZ: April 1 to March 31)
  const dateObj = new Date(asAt);
  const year = dateObj.getMonth() >= 3 ? dateObj.getFullYear() + 1 : dateObj.getFullYear();
  const fyStart = `${year - 1}-04-01`;
  const fyEnd = asAt;

  const plTotals = getLedgerPLTotals(businessId, fyStart, fyEnd);
  const currentYearEarnings = plTotals?.netProfit ?? 0;

  if (currentYearEarnings !== 0) {
    equityAccounts.push({
      code: "3300",
      name: "Current Year Earnings",
      amount: Math.round(currentYearEarnings * 100) / 100,
    });
  }

  const totalAssets = Math.round(assetAccounts.reduce((s, a) => s + a.amount, 0) * 100) / 100;
  const totalLiabilities = Math.round(liabilityAccounts.reduce((s, a) => s + a.amount, 0) * 100) / 100;
  const totalEquity = Math.round(equityAccounts.reduce((s, a) => s + a.amount, 0) * 100) / 100;
  const totalLiabilitiesAndEquity = Math.round((totalLiabilities + totalEquity) * 100) / 100;

  return {
    assets: { title: "Assets", accounts: assetAccounts, total: totalAssets },
    liabilities: { title: "Liabilities", accounts: liabilityAccounts, total: totalLiabilities },
    equity: { title: "Equity", accounts: equityAccounts, total: totalEquity },
    totalAssets,
    totalLiabilitiesAndEquity,
    isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
    asAt,
  };
}
