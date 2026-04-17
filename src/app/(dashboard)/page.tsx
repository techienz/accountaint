import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, and, desc, gte, lt, lte } from "drizzle-orm";
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
import { hasXeroConnection } from "@/lib/xero/status";
import { generateProfitAndLoss } from "@/lib/ledger/reports/profit-loss";
import { listInvoices } from "@/lib/invoices";
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
import { runHealthChecks, calculateHealthScore } from "@/lib/help/health-checks";
import { HealthChecklistCard } from "@/components/dashboard/health-checklist-card";
import { SetPageContext } from "@/components/page-context-provider";
import { PAGE_CONTEXTS } from "@/lib/help/page-context";
import { ActionItems, type ActionItemsData, type BankAccountAction } from "@/components/snapshot/action-items";
import { hasChartOfAccounts } from "@/lib/ledger/accounts";
import { getExistingOpeningBalance } from "@/lib/ledger/opening-balance";
import { checkMinimumWage, checkKiwisaverRates } from "@/lib/employees";
import { calculatePrescribedInterest } from "@/lib/shareholders/prescribed-interest";
import { getUnappliedChangesCount } from "@/lib/regulatory/verify";
import { getOptimisationSummary } from "@/lib/tax/optimisation/analyse";
import { TaxOptimisationCard } from "@/components/dashboard/tax-optimisation-card";
import type { XeroBankAccount } from "@/lib/xero/types";
import { todayNZ, formatDateNZ, monthStartNZ, monthEndNZ } from "@/lib/utils/dates";

function getActionItems(businessId: string): ActionItemsData {
  const db = getDb();
  const today = todayNZ();
  const weekFromNow = formatDateNZ(new Date(Date.now() + 7 * 86400000));

  // Bank accounts linked to this business (Akahu)
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

  // Xero bank accounts (only if Xero connected)
  if (hasXeroConnection(businessId)) {
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

  // Depreciation check
  const txYear = String(getNzTaxYear(new Date()));
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
          eq(schema.assetDepreciation.tax_year, txYear)
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

  // Employee compliance checks
  let minWageIssues = 0;
  let kiwisaverIssues = 0;
  const biz = db.select().from(schema.businesses).where(eq(schema.businesses.id, businessId)).get();
  if (biz?.has_employees) {
    try {
      minWageIssues = checkMinimumWage(businessId).length;
      kiwisaverIssues = checkKiwisaverRates(businessId).length;
    } catch { /* ignore */ }
  }

  // Prescribed interest checks
  const prescribedInterestDue: Array<{ name: string; amount: number }> = [];
  try {
    const currentTaxYear = getNzTaxYear(new Date());
    const shareholderRows = db
      .select()
      .from(schema.shareholders)
      .where(eq(schema.shareholders.business_id, businessId))
      .all();
    for (const sh of shareholderRows) {
      const result = calculatePrescribedInterest(businessId, sh.id, currentTaxYear);
      if (result.totalInterest > 0 && !result.hasBeenCharged) {
        prescribedInterestDue.push({
          name: decrypt(sh.name),
          amount: result.totalInterest,
        });
      }
    }
  } catch { /* ignore */ }

  let regulatoryUpdates = 0;
  try {
    regulatoryUpdates = getUnappliedChangesCount();
  } catch { /* no checks run yet */ }

  return {
    bankAccounts,
    draftExpenses,
    overdueInvoices,
    billsDueThisWeek,
    nextDeadline: null,
    needsDepreciation,
    needsOpeningBalances,
    minWageIssues,
    kiwisaverIssues,
    prescribedInterestDue,
    regulatoryUpdates,
    taxOptimisationSavings: (() => { try { return getOptimisationSummary(businessId).totalPotentialSaving; } catch { return 0; } })(),
  };
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/onboarding");

  const db = getDb();
  const businessId = session.activeBusiness.id;

  // Xero connection status
  const xeroConnected = hasXeroConnection(businessId);

  // Local-first: P&L from ledger
  const taxYear = getNzTaxYear(new Date());
  const plFrom = `${taxYear - 1}-04-01`;
  const plTo = todayNZ();
  let plRevenue = 0, plExpenses = 0, plNetProfit = 0, plHasData = false;
  try {
    const pl = generateProfitAndLoss(businessId, plFrom, plTo);
    plRevenue = pl.revenue.total;
    plExpenses = pl.expenses.total + pl.costOfGoodsSold.total;
    plNetProfit = pl.netProfit;
    plHasData = pl.revenue.accounts.length > 0 || pl.expenses.accounts.length > 0;
  } catch { /* no ledger data yet */ }

  // Local-first: bank accounts from Akahu
  const akahuAccounts = db
    .select()
    .from(schema.akahuAccounts)
    .where(eq(schema.akahuAccounts.linked_business_id, businessId))
    .all();
  const bankAccountInfos = akahuAccounts.map((a) => ({
    name: decrypt(a.name),
    balance: a.balance,
    source: "akahu" as const,
  }));

  // Local-first: AP/AR from local invoices
  const localInvoices = listInvoices(businessId);
  const totalReceivable = localInvoices
    .filter((inv) => inv.type === "ACCREC" && inv.amount_due > 0)
    .reduce((sum, inv) => sum + inv.amount_due, 0);
  const totalPayable = localInvoices
    .filter((inv) => inv.type === "ACCPAY" && inv.amount_due > 0)
    .reduce((sum, inv) => sum + inv.amount_due, 0);
  const overdueCount = localInvoices
    .filter((inv) => inv.status === "overdue" && inv.amount_due > 0)
    .length;
  const hasInvoiceData = localInvoices.length > 0;

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
    incorporation_date: biz.incorporation_date ?? undefined,
    fbt_registered: biz.fbt_registered ?? false,
    pays_contractors: biz.pays_contractors ?? false,
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

  // Find last sync time (Xero only)
  let lastSync: Date | null = null;
  if (xeroConnected) {
    const cache = db
      .select()
      .from(schema.xeroCache)
      .where(eq(schema.xeroCache.business_id, businessId))
      .all();
    if (cache.length > 0) {
      lastSync = new Date(Math.max(...cache.map((c) => c.synced_at.getTime())));
    }
  }

  // Get shareholder balances for dashboard
  const currentTaxYearStr = String(getNzTaxYear(now));
  const shareholderRows = db
    .select()
    .from(schema.shareholders)
    .where(eq(schema.shareholders.business_id, businessId))
    .all();

  const shareholderBalances = await Promise.all(
    shareholderRows.map(async (s) => {
      const balance = await getRunningBalance(s.id, currentTaxYearStr, businessId);
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
  const monthStart = monthStartNZ(now);
  const monthEnd = monthEndNZ(now);
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
    formatDateNZ(weekStartDate),
    formatDateNZ(now)
  );

  // Get tax savings summary
  let taxSavingsData: { monthlyTarget: number; shortfallOrSurplus: number } | null = null;
  try {
    const savings = await calculateTaxSavings(businessId, currentTaxYearStr);
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

  // Run business health checks
  const healthItems = runHealthChecks({
    id: businessId,
    entity_type: biz.entity_type,
    balance_date: biz.balance_date,
    gst_registered: biz.gst_registered,
    gst_filing_period: biz.gst_filing_period,
    has_employees: biz.has_employees,
    paye_frequency: biz.paye_frequency,
    provisional_tax_method: biz.provisional_tax_method,
  });
  const healthScore = calculateHealthScore(healthItems);

  // Action items
  const actionData = getActionItems(businessId);

  // Greeting based on time of day
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = session.user.name.split(" ")[0];

  return (
    <div className="space-y-10 max-w-[1400px]">
      <SetPageContext context={PAGE_CONTEXTS.dashboard} />

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
        {xeroConnected && <SyncStatus lastSync={lastSync} />}
      </div>

      {/* Quick links */}
      <div className="flex gap-3">
        {[
          { href: "/timesheets", label: "Timesheets", icon: "⏱" },
          { href: "/invoices", label: "Invoices", icon: "📄" },
          { href: "/expenses", label: "Expenses", icon: "💳" },
          { href: "/banking/reconcile", label: "Banking", icon: "🏦" },
          { href: "/payroll", label: "Payroll", icon: "💰" },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium text-card-foreground hover:bg-accent transition-colors"
          >
            <span>{link.icon}</span>
            {link.label}
          </a>
        ))}
      </div>

      {/* Action items */}
      <ActionItems data={actionData} />

      {/* Business health checklist */}
      <HealthChecklistCard items={healthItems} score={healthScore} />

      {/* Primary metrics — hero cards with gradient backgrounds */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <div className="card-hero-revenue rounded-xl">
          <ProfitLossCard revenue={plRevenue} expenses={plExpenses} netProfit={plNetProfit} hasData={plHasData} />
        </div>
        <div className="card-hero-cash rounded-xl">
          <CashPositionCard accounts={bankAccountInfos} />
        </div>
        <div className="card-hero-apar rounded-xl">
          <ApArCard totalReceivable={totalReceivable} totalPayable={totalPayable} overdueCount={overdueCount} hasData={hasInvoiceData} />
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
          <TaxRulesStatus {...getTaxRulesStatus()} pendingUpdates={actionData.regulatoryUpdates} />
          <TaxOptimisationCard />
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
          {xeroConnected && (
            <CrosscheckCard
              newAnomalyCount={newAnomalyCount}
              recentChangeCount={recentChangeCount}
            />
          )}
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
