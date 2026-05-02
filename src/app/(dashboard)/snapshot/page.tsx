import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, and, lt, lte, gte } from "drizzle-orm";
import { calculateSnapshotMetrics } from "@/lib/reports/snapshot";
import { calculateSnapshotMetricsFromLedger } from "@/lib/reports/snapshot-from-ledger";
import { compareSnapshots, formatDrift } from "@/lib/reports/snapshot-compare";
import { MetricCard } from "@/components/snapshot/metric-card";
import { CashFlowCard } from "@/components/snapshot/cash-flow-card";
import { ReceivablesCard } from "@/components/snapshot/receivables-card";
import { PayablesCard } from "@/components/snapshot/payables-card";
import { ActionItems, type ActionItemsData, type BankAccountAction } from "@/components/snapshot/action-items";
import type { XeroInvoice, XeroReport, XeroBankAccount } from "@/lib/xero/types";
import Link from "next/link";
import { ExplainButton } from "@/components/explain-button";
import { SetPageContext } from "@/components/page-context-provider";
import { PAGE_CONTEXTS } from "@/lib/help/page-context";
import { decrypt } from "@/lib/encryption";
import { hasChartOfAccounts } from "@/lib/ledger/accounts";
import { getExistingOpeningBalance } from "@/lib/ledger/opening-balance";
import { getNzTaxYear } from "@/lib/tax/rules";
import { todayNZ, formatDateNZ } from "@/lib/utils/dates";

function getActionItems(businessId: string, userId: string): ActionItemsData {
  const db = getDb();
  const today = todayNZ();
  const weekFromNow = formatDateNZ(new Date(Date.now() + 7 * 86400000));

  // Bank accounts linked to this business
  const akahuAccts = db
    .select()
    .from(schema.akahuAccounts)
    .where(eq(schema.akahuAccounts.linked_business_id, businessId))
    .all();

  const bankAccounts: BankAccountAction[] = akahuAccts.map((acct) => {
    const unmatchedCount = db
      .select({ id: schema.bankTransactions.id })
      .from(schema.bankTransactions)
      .where(
        and(
          eq(schema.bankTransactions.business_id, businessId),
          eq(schema.bankTransactions.akahu_account_id, acct.id),
          eq(schema.bankTransactions.reconciliation_status, "unmatched")
        )
      )
      .all().length;

    return {
      name: decrypt(acct.name),
      institution: decrypt(acct.institution),
      balance: acct.balance,
      unmatchedCount,
      lastSynced: acct.last_synced_at?.toISOString() ?? null,
      source: "akahu" as const,
    };
  });

  // Xero bank accounts (from cache)
  const xeroBankCache = db
    .select()
    .from(schema.xeroCache)
    .where(
      and(
        eq(schema.xeroCache.business_id, businessId),
        eq(schema.xeroCache.entity_type, "bank_accounts")
      )
    )
    .get();

  if (xeroBankCache?.data) {
    try {
      const xeroAccounts = JSON.parse(xeroBankCache.data) as XeroBankAccount[];
      for (const xa of xeroAccounts) {
        if (xa.Status !== "ACTIVE") continue;
        bankAccounts.push({
          name: xa.Name,
          institution: "Xero",
          balance: 0,
          unmatchedCount: 0,
          lastSynced: xeroBankCache.synced_at?.toISOString() ?? null,
          source: "xero",
        });
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Draft expenses
  const draftExpenses = db
    .select({ id: schema.expenses.id })
    .from(schema.expenses)
    .where(
      and(
        eq(schema.expenses.business_id, businessId),
        eq(schema.expenses.status, "draft")
      )
    )
    .all().length;

  // Overdue invoices (ACCREC, sent, due_date < today)
  const overdueRows = db
    .select({ total: schema.invoices.amount_due })
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.business_id, businessId),
        eq(schema.invoices.type, "ACCREC"),
        eq(schema.invoices.status, "sent"),
        lt(schema.invoices.due_date, today)
      )
    )
    .all();
  const overdueInvoices = {
    count: overdueRows.length,
    total: overdueRows.reduce((s, r) => s + (r.total ?? 0), 0),
  };

  // Bills due this week (ACCPAY, sent, due within 7 days)
  const billsRows = db
    .select({ total: schema.invoices.amount_due })
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.business_id, businessId),
        eq(schema.invoices.type, "ACCPAY"),
        eq(schema.invoices.status, "sent"),
        gte(schema.invoices.due_date, today),
        lte(schema.invoices.due_date, weekFromNow)
      )
    )
    .all();
  const billsDueThisWeek = {
    count: billsRows.length,
    total: billsRows.reduce((s, r) => s + (r.total ?? 0), 0),
  };

  // Depreciation check: assets exist but no depreciation for current tax year
  const taxYear = getNzTaxYear(new Date());
  const hasAssets = db
    .select({ id: schema.assets.id })
    .from(schema.assets)
    .where(
      and(
        eq(schema.assets.business_id, businessId),
        eq(schema.assets.disposed, false),
        eq(schema.assets.is_low_value, false)
      )
    )
    .limit(1)
    .all().length > 0;

  let needsDepreciation = false;
  if (hasAssets) {
    const hasDepForYear = db
      .select({ id: schema.assetDepreciation.id })
      .from(schema.assetDepreciation)
      .where(
        and(
          eq(schema.assetDepreciation.business_id, businessId),
          eq(schema.assetDepreciation.tax_year, String(taxYear))
        )
      )
      .limit(1)
      .all().length > 0;
    needsDepreciation = !hasDepForYear;
  }

  // Opening balances check
  const hasCoa = hasChartOfAccounts(businessId);
  const hasXero = db
    .select({ id: schema.xeroConnections.id })
    .from(schema.xeroConnections)
    .where(eq(schema.xeroConnections.business_id, businessId))
    .limit(1)
    .all().length > 0;
  const hasOpeningBalance = !!getExistingOpeningBalance(businessId);
  const needsOpeningBalances = hasCoa && !hasXero && !hasOpeningBalance;

  return {
    bankAccounts,
    draftExpenses,
    overdueInvoices,
    billsDueThisWeek,
    nextDeadline: null, // Could integrate with deadline engine later
    needsDepreciation,
    needsOpeningBalances,
    minWageIssues: 0,
    kiwisaverIssues: 0,
    prescribedInterestDue: [],
    regulatoryUpdates: 0,
    taxOptimisationSavings: 0,
  };
}

export default async function SnapshotPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/onboarding");

  const db = getDb();
  const businessId = session.activeBusiness.id;

  // Action items (works with or without Xero)
  const actionData = getActionItems(businessId, session.user.id);

  // Check Xero connection for financial metrics
  const xeroConnectionRows = db
    .select()
    .from(schema.xeroConnections)
    .where(eq(schema.xeroConnections.business_id, businessId))
    .limit(1)
    .all();
  const connected = xeroConnectionRows.length > 0;

  // Audit #129 — ledger is now the source of truth for /snapshot. Xero
  // (if connected) is an overlay that surfaces drift via a banner per
  // metric, so the snapshot works with or without Xero and any sync
  // mismatch is visible rather than hidden.
  const metrics = calculateSnapshotMetricsFromLedger(businessId);

  let xeroMetrics: typeof metrics | null = null;
  let compare: ReturnType<typeof compareSnapshots> | null = null;

  if (connected) {
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
    const monthlyPLRaw = getCacheData<{ Reports?: XeroReport[] } | XeroReport>("profit_loss_monthly");
    const monthlyPL: XeroReport | null =
      monthlyPLRaw && "Reports" in monthlyPLRaw && monthlyPLRaw.Reports?.[0]
        ? monthlyPLRaw.Reports[0]
        : (monthlyPLRaw as XeroReport | null);
    xeroMetrics = calculateSnapshotMetrics(invoices, monthlyPL);
    compare = compareSnapshots(metrics, xeroMetrics);
  }

  const snapshotContext = {
    ...PAGE_CONTEXTS.snapshot,
    dataSummary: `Revenue: $${metrics.revenue.thisMonth.toLocaleString()}, Expenses: $${metrics.expenses.thisMonth.toLocaleString()}, Net Profit: $${metrics.netProfit.thisMonth.toLocaleString()}`,
  };

  return (
    <div className="space-y-6">
      <SetPageContext context={snapshotContext} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Business Snapshot</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Month-over-month business health at a glance
          </p>
        </div>
        <ExplainButton context={snapshotContext} />
      </div>

      <ActionItems data={actionData} />

      {/* Source-of-truth banner — local ledger always; Xero comparison if connected. Audit #129. */}
      {!connected && (
        <p className="text-xs text-muted-foreground -mt-3">
          Computed from your local ledger. <Link href="/settings/xero" className="underline">Connect Xero</Link> to cross-check against your Xero data.
        </p>
      )}
      {connected && compare && compare.materialCount > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/60 p-3 text-xs space-y-1">
          <p className="font-medium">
            {compare.materialCount} metric{compare.materialCount === 1 ? "" : "s"} differ between local ledger and Xero cache:
          </p>
          {compare.revenue.material && <p>• Revenue: {formatDrift(compare.revenue)}</p>}
          {compare.expenses.material && <p>• Expenses: {formatDrift(compare.expenses)}</p>}
          {compare.netProfit.material && <p>• Net profit: {formatDrift(compare.netProfit)}</p>}
          {compare.receivables.material && <p>• Receivables: {formatDrift(compare.receivables)}</p>}
          {compare.payables.material && <p>• Payables: {formatDrift(compare.payables)}</p>}
          <p className="text-muted-foreground pt-1">
            Numbers shown below are local-ledger truth. Sync Xero or post missing journals to converge.
          </p>
        </div>
      )}
      {connected && compare && compare.materialCount === 0 && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 -mt-3">
          ✓ Local ledger and Xero cache agree on all key metrics.
        </p>
      )}

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
