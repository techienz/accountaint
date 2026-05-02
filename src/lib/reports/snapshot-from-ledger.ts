import { eq, and, gte, lte, lt } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { generateProfitAndLoss } from "@/lib/ledger/reports/profit-loss";
import { todayNZ, formatDateNZ } from "@/lib/utils/dates";
import type { SnapshotMetrics } from "./snapshot";

/**
 * Build SnapshotMetrics from local ledger + invoices/payments tables.
 * Mirrors the shape produced by the Xero-cache `calculateSnapshotMetrics`
 * so the two are directly diffable via `compareSnapshots()`. Audit #129.
 *
 * Source-of-truth mapping (local-first):
 *   - revenue / expenses / netProfit / margins → generateProfitAndLoss
 *   - cash in / cash out → payments table this month (invoice payments)
 *   - receivables → invoices ACCREC + amount_due > 0
 *   - payables → invoices ACCPAY + amount_due > 0
 *   - sparklines → generateProfitAndLoss month-by-month for 12 months
 */
export function calculateSnapshotMetricsFromLedger(businessId: string): SnapshotMetrics {
  const db = getDb();
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const thisMonthPL = generateProfitAndLoss(
    businessId,
    formatDateNZ(thisMonthStart),
    formatDateNZ(thisMonthEnd),
  );
  const lastMonthPL = generateProfitAndLoss(
    businessId,
    formatDateNZ(lastMonthStart),
    formatDateNZ(lastMonthEnd),
  );

  const revenueThisMonth = thisMonthPL.revenue.total;
  const revenueLastMonth = lastMonthPL.revenue.total;
  const expenseThisMonth = thisMonthPL.expenses.total + thisMonthPL.costOfGoodsSold.total;
  const expenseLastMonth = lastMonthPL.expenses.total + lastMonthPL.costOfGoodsSold.total;
  const profitThisMonth = thisMonthPL.netProfit;
  const profitLastMonth = lastMonthPL.netProfit;

  const grossMargin = revenueThisMonth > 0
    ? round1(thisMonthPL.grossProfit / revenueThisMonth * 100)
    : null;
  const netMargin = revenueThisMonth > 0
    ? round1(profitThisMonth / revenueThisMonth * 100)
    : null;

  const today = todayNZ();
  const oneWeek = formatDateNZ(new Date(Date.now() + 7 * 86400000));
  const monthEnd = formatDateNZ(thisMonthEnd);
  const thisMonthStartIso = formatDateNZ(thisMonthStart);

  // Cash in/out this month — sum of payments dated within this month, by invoice type.
  const paymentsThisMonth = db
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.business_id, businessId),
        gte(schema.payments.date, thisMonthStartIso),
        lte(schema.payments.date, formatDateNZ(thisMonthEnd)),
      ),
    )
    .all();

  let cashIn = 0;
  let cashOut = 0;
  if (paymentsThisMonth.length > 0) {
    const invoiceIds = Array.from(new Set(paymentsThisMonth.map((p) => p.invoice_id)));
    const invs = db
      .select({ id: schema.invoices.id, type: schema.invoices.type })
      .from(schema.invoices)
      .where(eq(schema.invoices.business_id, businessId))
      .all();
    const typeById = new Map(invs.filter((i) => invoiceIds.includes(i.id)).map((i) => [i.id, i.type]));
    for (const p of paymentsThisMonth) {
      const t = typeById.get(p.invoice_id);
      if (t === "ACCREC") cashIn += p.amount;
      else if (t === "ACCPAY") cashOut += p.amount;
    }
  }

  // Receivables: ACCREC invoices with amount_due > 0
  const arInvoices = db
    .select({
      id: schema.invoices.id,
      amount_due: schema.invoices.amount_due,
      due_date: schema.invoices.due_date,
      status: schema.invoices.status,
      date: schema.invoices.date,
    })
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.business_id, businessId),
        eq(schema.invoices.type, "ACCREC"),
      ),
    )
    .all()
    .filter((i) => i.amount_due > 0 && i.status !== "void");

  const totalReceivable = round2(arInvoices.reduce((s, i) => s + i.amount_due, 0));
  const overdue = arInvoices.filter((i) => i.due_date < today);
  const overdueCount = overdue.length;
  const overdueTotal = round2(overdue.reduce((s, i) => s + i.amount_due, 0));

  // Average collection days: stretch between invoice date and due date for paid sales
  const paidSales = db
    .select({ date: schema.invoices.date, due_date: schema.invoices.due_date })
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.business_id, businessId),
        eq(schema.invoices.type, "ACCREC"),
        eq(schema.invoices.status, "paid"),
      ),
    )
    .all();
  let avgCollectionDays: number | null = null;
  if (paidSales.length > 0) {
    const totalDays = paidSales.reduce((sum, inv) => {
      const issued = new Date(inv.date).getTime();
      const due = new Date(inv.due_date).getTime();
      return sum + Math.max(0, (due - issued) / (1000 * 60 * 60 * 24));
    }, 0);
    avgCollectionDays = Math.round(totalDays / paidSales.length);
  }

  // Payables: ACCPAY invoices with amount_due > 0
  const apInvoices = db
    .select({
      id: schema.invoices.id,
      amount_due: schema.invoices.amount_due,
      due_date: schema.invoices.due_date,
      status: schema.invoices.status,
    })
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.business_id, businessId),
        eq(schema.invoices.type, "ACCPAY"),
      ),
    )
    .all()
    .filter((i) => i.amount_due > 0 && i.status !== "void");
  const totalPayable = round2(apInvoices.reduce((s, i) => s + i.amount_due, 0));
  const dueThisWeek = round2(
    apInvoices.filter((i) => i.due_date <= oneWeek).reduce((s, i) => s + i.amount_due, 0),
  );
  const dueThisMonth = round2(
    apInvoices.filter((i) => i.due_date <= monthEnd).reduce((s, i) => s + i.amount_due, 0),
  );

  // 12-month sparkline from the ledger
  const revenueSpark: number[] = [];
  const profitSpark: number[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const pl = generateProfitAndLoss(
      businessId,
      formatDateNZ(start),
      formatDateNZ(end),
    );
    revenueSpark.push(round2(pl.revenue.total));
    profitSpark.push(round2(pl.netProfit));
  }

  return {
    revenue: {
      thisMonth: round2(revenueThisMonth),
      lastMonth: round2(revenueLastMonth),
      percentChange: pctChange(revenueThisMonth, revenueLastMonth),
    },
    expenses: {
      thisMonth: round2(expenseThisMonth),
      lastMonth: round2(expenseLastMonth),
      percentChange: pctChange(expenseThisMonth, expenseLastMonth),
    },
    netProfit: {
      thisMonth: round2(profitThisMonth),
      lastMonth: round2(profitLastMonth),
      percentChange: pctChange(profitThisMonth, profitLastMonth),
    },
    cashFlow: {
      cashIn: round2(cashIn),
      cashOut: round2(cashOut),
      net: round2(cashIn - cashOut),
    },
    margins: { gross: grossMargin, net: netMargin },
    receivables: {
      totalOutstanding: totalReceivable,
      overdueCount,
      overdueTotal,
      avgCollectionDays,
    },
    payables: {
      totalOutstanding: totalPayable,
      dueThisWeek,
      dueThisMonth,
    },
    sparklines: { revenue: revenueSpark, profit: profitSpark },
  };
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
function round1(n: number): number { return Math.round(n * 10) / 10; }
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : 100;
  return round1(((current - previous) / Math.abs(previous)) * 100);
}
