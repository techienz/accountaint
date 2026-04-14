import { getTrialBalance } from "../journals";

export type ProfitLossSection = {
  title: string;
  accounts: Array<{ code: string; name: string; amount: number }>;
  total: number;
};

export type ProfitLossReport = {
  revenue: ProfitLossSection;
  costOfGoodsSold: ProfitLossSection;
  grossProfit: number;
  expenses: ProfitLossSection;
  netProfit: number;
  period: { from: string; to: string };
};

/**
 * Generate a P&L report from journal entries.
 * Revenue accounts have credit balances (shown as positive).
 * Expense accounts have debit balances (shown as positive).
 */
export function generateProfitAndLoss(
  businessId: string,
  from: string,
  to: string
): ProfitLossReport {
  const rows = getTrialBalance(businessId, { from, to });

  const revenueAccounts = rows
    .filter((r) => r.type === "revenue")
    .map((r) => ({ code: r.code, name: r.name, amount: Math.abs(r.credit - r.debit) }));

  const cogsAccounts = rows
    .filter((r) => r.sub_type === "cogs")
    .map((r) => ({ code: r.code, name: r.name, amount: Math.abs(r.debit - r.credit) }));

  const expenseAccounts = rows
    .filter((r) => r.type === "expense" && r.sub_type !== "cogs")
    .map((r) => ({ code: r.code, name: r.name, amount: Math.abs(r.debit - r.credit) }));

  const totalRevenue = Math.round(revenueAccounts.reduce((s, a) => s + a.amount, 0) * 100) / 100;
  const totalCogs = Math.round(cogsAccounts.reduce((s, a) => s + a.amount, 0) * 100) / 100;
  const totalExpenses = Math.round(expenseAccounts.reduce((s, a) => s + a.amount, 0) * 100) / 100;
  const grossProfit = Math.round((totalRevenue - totalCogs) * 100) / 100;
  const netProfit = Math.round((grossProfit - totalExpenses) * 100) / 100;

  return {
    revenue: { title: "Revenue", accounts: revenueAccounts, total: totalRevenue },
    costOfGoodsSold: { title: "Cost of Goods Sold", accounts: cogsAccounts, total: totalCogs },
    grossProfit,
    expenses: { title: "Expenses", accounts: expenseAccounts, total: totalExpenses },
    netProfit,
    period: { from, to },
  };
}

/**
 * Get P&L totals in the same shape as extractTotals() from parsers.ts.
 * This allows ledger data to be used anywhere Xero P&L data was used.
 */
export function getLedgerPLTotals(
  businessId: string,
  from: string,
  to: string
): { revenue: number; expenses: number; netProfit: number } | null {
  const rows = getTrialBalance(businessId, { from, to });
  if (rows.length === 0) return null;

  const revenue = rows
    .filter((r) => r.type === "revenue")
    .reduce((s, r) => s + (r.credit - r.debit), 0);

  const expenses = rows
    .filter((r) => r.type === "expense")
    .reduce((s, r) => s + (r.debit - r.credit), 0);

  return {
    revenue: Math.round(revenue * 100) / 100,
    expenses: Math.round(expenses * 100) / 100,
    netProfit: Math.round((revenue - expenses) * 100) / 100,
  };
}
