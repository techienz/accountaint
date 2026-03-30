import type { XeroInvoice, XeroReport, XeroReportRow } from "@/lib/xero/types";

export type SnapshotMetrics = {
  revenue: { thisMonth: number; lastMonth: number; percentChange: number | null };
  expenses: { thisMonth: number; lastMonth: number; percentChange: number | null };
  netProfit: { thisMonth: number; lastMonth: number; percentChange: number | null };
  cashFlow: { cashIn: number; cashOut: number; net: number };
  margins: { gross: number | null; net: number | null };
  receivables: {
    totalOutstanding: number;
    overdueCount: number;
    overdueTotal: number;
    avgCollectionDays: number | null;
  };
  payables: {
    totalOutstanding: number;
    dueThisWeek: number;
    dueThisMonth: number;
  };
  sparklines: {
    revenue: number[];
    profit: number[];
  };
};

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : 100;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

function getThisMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

function getLastMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  return { start, end };
}

function invoicesInRange(invoices: XeroInvoice[], start: Date, end: Date, type: "ACCREC" | "ACCPAY") {
  return invoices.filter((inv) => {
    const date = new Date(inv.Date);
    return inv.Type === type && date >= start && date <= end;
  });
}

function paidInRange(invoices: XeroInvoice[], start: Date, end: Date, type: "ACCREC" | "ACCPAY") {
  return invoices.filter((inv) => {
    if (inv.Type !== type || inv.Status !== "PAID") return false;
    // Use invoice date as proxy for payment date
    const date = new Date(inv.Date);
    return date >= start && date <= end;
  });
}

export function getMonthlyTotals(invoices: XeroInvoice[], months: number = 12): { revenue: number[]; profit: number[] } {
  const now = new Date();
  const revenue: number[] = [];
  const expenses: number[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

    const monthRevenue = invoicesInRange(invoices, start, end, "ACCREC")
      .reduce((sum, inv) => sum + inv.Total, 0);
    const monthExpenses = invoicesInRange(invoices, start, end, "ACCPAY")
      .reduce((sum, inv) => sum + inv.Total, 0);

    revenue.push(Math.round(monthRevenue * 100) / 100);
    expenses.push(Math.round(monthExpenses * 100) / 100);
  }

  const profit = revenue.map((r, i) => Math.round((r - expenses[i]) * 100) / 100);
  return { revenue, profit };
}

/**
 * Parse the multi-period Xero P&L report to extract monthly totals.
 * The report has rows with cells for each month column.
 */
export function extractMonthlyPLTotals(monthlyReport: XeroReport): {
  revenue: number[];
  expenses: number[];
  netProfit: number[];
  grossProfit: number[];
} | null {
  if (!monthlyReport?.Rows) return null;

  const rows = monthlyReport.Rows;
  // Find key summary rows
  let revenueRow: XeroReportRow | null = null;
  let expenseRow: XeroReportRow | null = null;
  let netProfitRow: XeroReportRow | null = null;
  let grossProfitRow: XeroReportRow | null = null;

  function findRow(rows: XeroReportRow[], title: string): XeroReportRow | null {
    for (const row of rows) {
      if (row.RowType === "SummaryRow" && row.Cells?.[0]?.Value?.includes(title)) {
        return row;
      }
      if (row.Rows) {
        const found = findRow(row.Rows, title);
        if (found) return found;
      }
    }
    return null;
  }

  revenueRow = findRow(rows, "Total Income") || findRow(rows, "Total Revenue");
  expenseRow = findRow(rows, "Total Expenses") || findRow(rows, "Total Operating Expenses");
  netProfitRow = findRow(rows, "Net Profit") || findRow(rows, "Net Income");
  grossProfitRow = findRow(rows, "Gross Profit");

  function extractValues(row: XeroReportRow | null): number[] {
    if (!row?.Cells) return [];
    // Skip first cell (label), take the rest as values
    return row.Cells.slice(1).map((cell) => parseFloat(cell.Value) || 0);
  }

  const revenue = extractValues(revenueRow);
  if (revenue.length === 0) return null;

  const expenses = extractValues(expenseRow);
  let netProfit = extractValues(netProfitRow);

  // If no "Net Profit" row found, derive from revenue - expenses
  if (netProfit.length === 0 && revenue.length > 0) {
    netProfit = revenue.map((r, i) => r - (expenses[i] || 0));
  }

  return {
    revenue,
    expenses,
    netProfit,
    grossProfit: extractValues(grossProfitRow),
  };
}

export function calculateSnapshotMetrics(
  invoices: XeroInvoice[],
  monthlyPL: XeroReport | null
): SnapshotMetrics {
  const thisMonth = getThisMonthRange();
  const lastMonth = getLastMonthRange();

  // Try monthly P&L first for revenue/expenses
  let plData: ReturnType<typeof extractMonthlyPLTotals> = null;
  if (monthlyPL) {
    plData = extractMonthlyPLTotals(monthlyPL);
  }

  let revenueThisMonth: number;
  let revenueLastMonth: number;
  let expenseThisMonth: number;
  let expenseLastMonth: number;
  let sparklineRevenue: number[];
  let sparklineProfit: number[];
  let grossMargin: number | null = null;
  let netMargin: number | null = null;

  if (plData && plData.revenue.length >= 2) {
    // Use P&L data (most recent month is last in array)
    const len = plData.revenue.length;
    revenueThisMonth = plData.revenue[len - 1];
    revenueLastMonth = plData.revenue[len - 2];
    expenseThisMonth = plData.expenses[len - 1];
    expenseLastMonth = plData.expenses[len - 2];
    sparklineRevenue = plData.revenue;
    sparklineProfit = plData.netProfit;

    // Calculate margins from P&L
    if (revenueThisMonth > 0) {
      if (plData.grossProfit.length >= len) {
        grossMargin = Math.round((plData.grossProfit[len - 1] / revenueThisMonth) * 1000) / 10;
      }
      if (plData.netProfit.length >= len) {
        netMargin = Math.round((plData.netProfit[len - 1] / revenueThisMonth) * 1000) / 10;
      }
    }
  } else {
    // Fall back to invoice-derived data
    const thisMonthSales = invoicesInRange(invoices, thisMonth.start, thisMonth.end, "ACCREC");
    const lastMonthSales = invoicesInRange(invoices, lastMonth.start, lastMonth.end, "ACCREC");
    const thisMonthPurchases = invoicesInRange(invoices, thisMonth.start, thisMonth.end, "ACCPAY");
    const lastMonthPurchases = invoicesInRange(invoices, lastMonth.start, lastMonth.end, "ACCPAY");

    revenueThisMonth = thisMonthSales.reduce((s, i) => s + i.Total, 0);
    revenueLastMonth = lastMonthSales.reduce((s, i) => s + i.Total, 0);
    expenseThisMonth = thisMonthPurchases.reduce((s, i) => s + i.Total, 0);
    expenseLastMonth = lastMonthPurchases.reduce((s, i) => s + i.Total, 0);

    const monthly = getMonthlyTotals(invoices, 12);
    sparklineRevenue = monthly.revenue;
    sparklineProfit = monthly.profit;
  }

  const profitThisMonth = revenueThisMonth - expenseThisMonth;
  const profitLastMonth = revenueLastMonth - expenseLastMonth;

  // Cash flow (this month paid invoices)
  const cashIn = paidInRange(invoices, thisMonth.start, thisMonth.end, "ACCREC")
    .reduce((s, i) => s + i.AmountPaid, 0);
  const cashOut = paidInRange(invoices, thisMonth.start, thisMonth.end, "ACCPAY")
    .reduce((s, i) => s + i.AmountPaid, 0);

  // Receivables
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const outstanding = invoices.filter(
    (i) => i.Type === "ACCREC" && i.AmountDue > 0 && i.Status !== "VOIDED" && i.Status !== "DELETED"
  );
  const overdue = outstanding.filter((i) => new Date(i.DueDate) < now);
  const totalReceivable = outstanding.reduce((s, i) => s + i.AmountDue, 0);

  // Average collection days from paid invoices
  const paidSales = invoices.filter(
    (i) => i.Type === "ACCREC" && i.Status === "PAID"
  );
  let avgCollectionDays: number | null = null;
  if (paidSales.length > 0) {
    const totalDays = paidSales.reduce((sum, inv) => {
      const issued = new Date(inv.Date).getTime();
      const due = new Date(inv.DueDate).getTime();
      return sum + Math.max(0, (due - issued) / (1000 * 60 * 60 * 24));
    }, 0);
    avgCollectionDays = Math.round(totalDays / paidSales.length);
  }

  // Payables
  const outstandingAP = invoices.filter(
    (i) => i.Type === "ACCPAY" && i.AmountDue > 0 && i.Status !== "VOIDED" && i.Status !== "DELETED"
  );
  const totalPayable = outstandingAP.reduce((s, i) => s + i.AmountDue, 0);
  const oneWeek = new Date(now);
  oneWeek.setDate(oneWeek.getDate() + 7);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const dueThisWeek = outstandingAP
    .filter((i) => new Date(i.DueDate) <= oneWeek)
    .reduce((s, i) => s + i.AmountDue, 0);
  const dueThisMonth = outstandingAP
    .filter((i) => new Date(i.DueDate) <= endOfMonth)
    .reduce((s, i) => s + i.AmountDue, 0);

  return {
    revenue: {
      thisMonth: Math.round(revenueThisMonth * 100) / 100,
      lastMonth: Math.round(revenueLastMonth * 100) / 100,
      percentChange: percentChange(revenueThisMonth, revenueLastMonth),
    },
    expenses: {
      thisMonth: Math.round(expenseThisMonth * 100) / 100,
      lastMonth: Math.round(expenseLastMonth * 100) / 100,
      percentChange: percentChange(expenseThisMonth, expenseLastMonth),
    },
    netProfit: {
      thisMonth: Math.round(profitThisMonth * 100) / 100,
      lastMonth: Math.round(profitLastMonth * 100) / 100,
      percentChange: percentChange(profitThisMonth, profitLastMonth),
    },
    cashFlow: {
      cashIn: Math.round(cashIn * 100) / 100,
      cashOut: Math.round(cashOut * 100) / 100,
      net: Math.round((cashIn - cashOut) * 100) / 100,
    },
    margins: { gross: grossMargin, net: netMargin },
    receivables: {
      totalOutstanding: Math.round(totalReceivable * 100) / 100,
      overdueCount: overdue.length,
      overdueTotal: Math.round(overdue.reduce((s, i) => s + i.AmountDue, 0) * 100) / 100,
      avgCollectionDays,
    },
    payables: {
      totalOutstanding: Math.round(totalPayable * 100) / 100,
      dueThisWeek: Math.round(dueThisWeek * 100) / 100,
      dueThisMonth: Math.round(dueThisMonth * 100) / 100,
    },
    sparklines: { revenue: sparklineRevenue, profit: sparklineProfit },
  };
}
