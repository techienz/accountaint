import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { calculateSnapshotMetrics } from "@/lib/reports/snapshot";
import { MetricCard } from "@/components/snapshot/metric-card";
import { CashFlowCard } from "@/components/snapshot/cash-flow-card";
import { ReceivablesCard } from "@/components/snapshot/receivables-card";
import { PayablesCard } from "@/components/snapshot/payables-card";
import type { XeroInvoice, XeroReport } from "@/lib/xero/types";
import Link from "next/link";

export default async function SnapshotPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/onboarding");

  const db = getDb();
  const businessId = session.activeBusiness.id;

  // Check Xero connection
  const xeroConnectionRows = db
    .select()
    .from(schema.xeroConnections)
    .where(eq(schema.xeroConnections.business_id, businessId))
    .limit(1)
    .all();
  const connected = xeroConnectionRows.length > 0;

  if (!connected) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Business Snapshot</h1>
        <p className="text-muted-foreground">
          <Link href="/settings/xero" className="text-primary hover:underline">
            Connect Xero
          </Link>{" "}
          to see your business snapshot.
        </p>
      </div>
    );
  }

  // Get cached data
  const cache = db
    .select()
    .from(schema.xeroCache)
    .where(eq(schema.xeroCache.business_id, businessId))
    .all();
  const cacheMap = new Map(cache.map((c) => [c.entity_type, c]));

  function getCacheData<T>(type: string): T | null {
    const entry = cacheMap.get(type);
    if (!entry) return null;
    try { return JSON.parse(entry.data) as T; } catch { return null; }
  }

  const invoicesData = getCacheData<{ Invoices: XeroInvoice[] }>("invoices");
  const invoices: XeroInvoice[] = invoicesData?.Invoices || [];

  // Xero wraps reports in { Reports: [...] } — unwrap to get the actual report
  const monthlyPLRaw = getCacheData<{ Reports?: XeroReport[] } | XeroReport>("profit_loss_monthly");
  const monthlyPL: XeroReport | null =
    monthlyPLRaw && "Reports" in monthlyPLRaw && monthlyPLRaw.Reports?.[0]
      ? monthlyPLRaw.Reports[0]
      : (monthlyPLRaw as XeroReport | null);

  const metrics = calculateSnapshotMetrics(invoices, monthlyPL);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Business Snapshot</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Month-over-month business health at a glance
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Revenue"
          value={metrics.revenue.thisMonth}
          previousValue={metrics.revenue.lastMonth}
          percentChange={metrics.revenue.percentChange}
          sparklineData={metrics.sparklines.revenue}
          sparklineColor="#22c55e"
        />
        <MetricCard
          title="Expenses"
          value={metrics.expenses.thisMonth}
          previousValue={metrics.expenses.lastMonth}
          percentChange={metrics.expenses.percentChange}
        />
        <MetricCard
          title="Net Profit"
          value={metrics.netProfit.thisMonth}
          previousValue={metrics.netProfit.lastMonth}
          percentChange={metrics.netProfit.percentChange}
          sparklineData={metrics.sparklines.profit}
          sparklineColor={metrics.netProfit.thisMonth >= 0 ? "#22c55e" : "#ef4444"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <CashFlowCard
          cashIn={metrics.cashFlow.cashIn}
          cashOut={metrics.cashFlow.cashOut}
          net={metrics.cashFlow.net}
        />
        <ReceivablesCard
          totalOutstanding={metrics.receivables.totalOutstanding}
          overdueCount={metrics.receivables.overdueCount}
          overdueTotal={metrics.receivables.overdueTotal}
          avgCollectionDays={metrics.receivables.avgCollectionDays}
        />
        <PayablesCard
          totalOutstanding={metrics.payables.totalOutstanding}
          dueThisWeek={metrics.payables.dueThisWeek}
          dueThisMonth={metrics.payables.dueThisMonth}
        />
      </div>

      {(metrics.margins.gross != null || metrics.margins.net != null) && (
        <div className="grid gap-4 md:grid-cols-2">
          {metrics.margins.gross != null && (
            <MetricCard
              title="Gross Margin"
              value={metrics.margins.gross}
              prefix=""
            />
          )}
          {metrics.margins.net != null && (
            <MetricCard
              title="Net Margin"
              value={metrics.margins.net}
              prefix=""
            />
          )}
        </div>
      )}
    </div>
  );
}
