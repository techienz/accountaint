import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, and, desc, gte } from "drizzle-orm";
import { calculateDeadlines } from "@/lib/tax/deadlines";
import { ProfitLossCard } from "@/components/dashboard/profit-loss-card";
import { CashPositionCard } from "@/components/dashboard/cash-position-card";
import { GstCard } from "@/components/dashboard/gst-card";
import { DeadlinesCard } from "@/components/dashboard/deadlines-card";
import { AlertsCard } from "@/components/dashboard/alerts-card";
import { SyncStatus } from "@/components/dashboard/sync-status";
import { ApArCard } from "@/components/dashboard/ap-ar-card";
import { CrosscheckCard } from "@/components/dashboard/crosscheck-card";
import { TaxSavingsCard } from "@/components/dashboard/tax-savings-card";
import { BalanceCard } from "@/components/shareholders/balance-card";
import type { XeroInvoice } from "@/lib/xero/types";
import { getRunningBalance } from "@/lib/shareholders/balance";
import { calculateTaxSavings } from "@/lib/tax/savings-calculator";
import { getNzTaxYear, getTaxRulesStatus } from "@/lib/tax/rules";
import { TaxRulesStatus } from "@/components/dashboard/tax-rules-status";
import { decrypt } from "@/lib/encryption";
import { getContractSummary } from "@/lib/contracts";
import { ContractsCard } from "@/components/dashboard/contracts-card";
import { getExpenseSummary } from "@/lib/expenses";
import { ExpenseCard } from "@/components/dashboard/expense-card";
import { getWorkContractSummary } from "@/lib/work-contracts";
import { WorkContractsCard } from "@/components/dashboard/work-contracts-card";
import { getTimesheetSummary } from "@/lib/timesheets";
import { TimesheetsCard } from "@/components/dashboard/timesheets-card";
import { getInvoiceSummary } from "@/lib/invoices";
import { InvoicesCard } from "@/components/dashboard/invoices-card";
import { getBudgetOverview } from "@/lib/budget/calculations";
import { BudgetCard } from "@/components/dashboard/budget-card";
import { listIncomes } from "@/lib/budget";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/onboarding");

  const db = getDb();
  const businessId = session.activeBusiness.id;

  // Get Xero connection status
  const xeroConnectionRows = db
    .select()
    .from(schema.xeroConnections)
    .where(eq(schema.xeroConnections.business_id, businessId))
    .limit(1)
    .all();
  const xeroConnection = xeroConnectionRows[0] || null;

  // Get cached Xero data
  const cache = db
    .select()
    .from(schema.xeroCache)
    .where(eq(schema.xeroCache.business_id, businessId))
    .all();
  const cacheMap = new Map(cache.map((c) => [c.entity_type, c]));

  // Parse cached data safely
  function getCacheData(type: string) {
    const entry = cacheMap.get(type);
    if (!entry) return null;
    try {
      return JSON.parse(entry.data);
    } catch {
      return null;
    }
  }

  const profitLoss = getCacheData("profit_loss");
  const bankAccounts = getCacheData("bank_accounts");
  const invoicesData = getCacheData("invoices");
  const invoices: XeroInvoice[] = invoicesData?.Invoices || [];

  // Calculate upcoming deadlines
  const now = new Date();
  const sixMonthsOut = new Date(now);
  sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6);

  const biz = session.activeBusiness;
  const allDeadlines = calculateDeadlines({
    entity_type: biz.entity_type as "company" | "sole_trader" | "partnership" | "trust",
    balance_date: biz.balance_date,
    gst_registered: biz.gst_registered,
    gst_filing_period: biz.gst_filing_period as "monthly" | "2monthly" | "6monthly" | undefined,
    has_employees: biz.has_employees,
    paye_frequency: biz.paye_frequency as "monthly" | "twice_monthly" | undefined,
    provisional_tax_method: biz.provisional_tax_method as "standard" | "estimation" | "aim" | undefined,
    dateRange: { from: now, to: sixMonthsOut },
  });

  // Get recent notifications
  const notifications = db
    .select()
    .from(schema.notificationItems)
    .where(eq(schema.notificationItems.business_id, businessId))
    .orderBy(desc(schema.notificationItems.created_at))
    .limit(5)
    .all();

  // Count new anomalies and recent changes for crosscheck card
  const newAnomalyCount = db
    .select()
    .from(schema.anomalies)
    .where(
      and(
        eq(schema.anomalies.business_id, businessId),
        eq(schema.anomalies.status, "new")
      )
    )
    .all().length;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentChangeCount = db
    .select()
    .from(schema.changeReports)
    .where(
      and(
        eq(schema.changeReports.business_id, businessId),
        gte(schema.changeReports.created_at, thirtyDaysAgo)
      )
    )
    .all().length;

  // Find last sync time
  const lastSync = cache.length > 0
    ? new Date(Math.max(...cache.map((c) => c.synced_at.getTime())))
    : null;

  // Get shareholder balances for dashboard
  const taxYear = String(getNzTaxYear(now));
  const shareholderRows = db
    .select()
    .from(schema.shareholders)
    .where(eq(schema.shareholders.business_id, businessId))
    .all();

  const shareholderBalances = await Promise.all(
    shareholderRows.map(async (s) => {
      const balance = await getRunningBalance(s.id, taxYear, businessId);
      return {
        id: s.id,
        name: decrypt(s.name),
        balance: balance.closingBalance,
        isOverdrawn: balance.isOverdrawn,
        ownershipPercentage: s.ownership_percentage,
      };
    })
  );

  // Get contract summary
  const contractSummary = getContractSummary(businessId);

  // Get expense summary for this month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const expenseSummary = getExpenseSummary(businessId, monthStart, monthEnd);

  // Get work contract summary
  const workContractSummary = getWorkContractSummary(businessId);

  // Get invoice summary
  const invoiceSummary = getInvoiceSummary(businessId);

  // Get timesheet summary for this week
  const weekDay = now.getDay();
  const mondayOffset = weekDay === 0 ? -6 : 1 - weekDay;
  const weekStartDate = new Date(now);
  weekStartDate.setDate(now.getDate() + mondayOffset);
  weekStartDate.setHours(0, 0, 0, 0);
  const timesheetSummary = getTimesheetSummary(
    businessId,
    weekStartDate.toISOString().slice(0, 10),
    now.toISOString().slice(0, 10)
  );

  // Get tax savings summary
  let taxSavingsData: { monthlyTarget: number; shortfallOrSurplus: number } | null = null;
  try {
    const savings = await calculateTaxSavings(businessId, taxYear);
    taxSavingsData = {
      monthlyTarget: savings.totalToSetAside / 12,
      shortfallOrSurplus: savings.shortfallOrSurplus,
    };
  } catch {
    // Tax savings not available yet
  }

  // Get personal budget summary (per-user, not per-business)
  let budgetData: {
    fortnightlyIncome: number;
    fortnightlyExpenses: number;
    fortnightlyRemaining: number;
    billsDueCount: number;
  } | null = null;
  try {
    const budgetIncomes = listIncomes(session.user.id);
    if (budgetIncomes.length > 0) {
      const overview = getBudgetOverview(session.user.id);
      budgetData = {
        fortnightlyIncome: overview.totalFortnightlyIncome,
        fortnightlyExpenses: overview.totalFortnightlyExpenses,
        fortnightlyRemaining: overview.fortnightlyRemaining,
        billsDueCount: overview.thisFortnightItems.length,
      };
    }
  } catch {
    // Budget not set up yet
  }

  // Greeting based on time of day
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = session.user.name.split(" ")[0];

  return (
    <div className="space-y-10 max-w-[1400px]">
      {/* Dashboard header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[1.75rem] font-bold tracking-tight text-foreground">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1.5 text-[0.9rem] text-muted-foreground">
            Here&apos;s how {biz.name} is tracking
          </p>
        </div>
        {xeroConnection && <SyncStatus lastSync={lastSync} />}
      </div>

      {/* Primary metrics — hero cards with gradient backgrounds */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <div className="card-hero-revenue rounded-xl">
          <ProfitLossCard data={profitLoss} connected={!!xeroConnection} />
        </div>
        <div className="card-hero-cash rounded-xl">
          <CashPositionCard data={bankAccounts} connected={!!xeroConnection} />
        </div>
        <div className="card-hero-apar rounded-xl">
          <ApArCard invoices={invoices} connected={!!xeroConnection} />
        </div>
      </div>

      {/* Obligations & tracking */}
      <div>
        <h2 className="section-label mb-5">Obligations & Tracking</h2>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {biz.gst_registered && (
            <GstCard
              deadlines={allDeadlines.filter((d) => d.type === "gst")}
              filingPeriod={biz.gst_filing_period}
            />
          )}
          <DeadlinesCard deadlines={allDeadlines.slice(0, 5)} />
          {taxSavingsData && (
            <TaxSavingsCard
              monthlyTarget={taxSavingsData.monthlyTarget}
              shortfallOrSurplus={taxSavingsData.shortfallOrSurplus}
            />
          )}
          <TaxRulesStatus {...getTaxRulesStatus()} />
        </div>
      </div>

      {/* Business operations */}
      <div>
        <h2 className="section-label mb-5">Business Operations</h2>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <WorkContractsCard
            activeContracts={workContractSummary.activeContracts}
            totalWeeklyHours={workContractSummary.totalWeeklyHours}
            totalProjectedEarnings={workContractSummary.totalProjectedEarnings}
            expiringCount={workContractSummary.expiringCount}
          />
          <TimesheetsCard
            totalHours={timesheetSummary.totalHours}
            billableRatio={timesheetSummary.billableRatio}
            totalEarnings={timesheetSummary.totalEarnings}
          />
          <InvoicesCard
            totalReceivable={invoiceSummary.totalReceivable}
            totalPayable={invoiceSummary.totalPayable}
            overdueCount={invoiceSummary.overdueCount}
            overdueAmount={invoiceSummary.overdueAmount}
          />
          <ContractsCard
            monthlyTotal={contractSummary.monthlyTotal}
            expiringCount={contractSummary.expiringCount}
            totalContracts={contractSummary.totalContracts}
          />
          <ExpenseCard
            monthTotal={expenseSummary.grandTotal}
            topCategory={expenseSummary.byCategory[0] || null}
          />
          <CrosscheckCard
            newAnomalyCount={newAnomalyCount}
            recentChangeCount={recentChangeCount}
          />
        </div>
      </div>

      {/* People & alerts */}
      {(shareholderBalances.length > 0 || notifications.length > 0) && (
        <div>
          <h2 className="section-label mb-5">People & Alerts</h2>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {shareholderBalances.map((s) => (
              <BalanceCard
                key={s.id}
                name={s.name}
                balance={s.balance}
                isOverdrawn={s.isOverdrawn}
                ownershipPercentage={s.ownershipPercentage}
              />
            ))}
            <AlertsCard notifications={notifications} />
          </div>
        </div>
      )}

      {/* Personal Finance */}
      {budgetData && (
        <div>
          <h2 className="section-label mb-5">Personal Finance</h2>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <BudgetCard
              fortnightlyIncome={budgetData.fortnightlyIncome}
              fortnightlyExpenses={budgetData.fortnightlyExpenses}
              fortnightlyRemaining={budgetData.fortnightlyRemaining}
              billsDueCount={budgetData.billsDueCount}
            />
          </div>
        </div>
      )}
    </div>
  );
}
