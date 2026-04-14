import { getDb, schema } from "@/lib/db";
import { eq, and, gte } from "drizzle-orm";
import { calculateDeadlines } from "@/lib/tax/deadlines";
import { hasChartOfAccounts } from "@/lib/ledger/accounts";

export type HealthCheckStatus = "good" | "warning" | "action_needed";

export type HealthCheckItem = {
  id: string;
  title: string;
  /** Plain-English explanation of what this means and why it matters */
  description: string;
  status: HealthCheckStatus;
  /** What the user should do (null if status is "good") */
  action?: string;
  /** Link to the relevant page */
  link?: string;
  /** Category for grouping */
  category: "setup" | "compliance" | "bookkeeping" | "monitoring";
};

type BusinessConfig = {
  id: string;
  entity_type: string;
  balance_date: string;
  gst_registered: boolean;
  gst_filing_period?: string | null;
  has_employees: boolean;
  paye_frequency?: string | null;
  provisional_tax_method?: string | null;
};

export function runHealthChecks(business: BusinessConfig): HealthCheckItem[] {
  const items: HealthCheckItem[] = [];
  const db = getDb();
  const now = new Date();

  // --- SETUP CHECKS ---

  // Xero connection
  const xeroConn = db
    .select()
    .from(schema.xeroConnections)
    .where(eq(schema.xeroConnections.business_id, business.id))
    .limit(1)
    .all();

  if (xeroConn.length === 0) {
    items.push({
      id: "xero-connected",
      title: "Connect to Xero",
      description:
        "Connecting Xero lets us pull in your invoices, bank accounts, and financial reports automatically. Without it, you'll need to enter everything manually.",
      status: "warning",
      action: "Go to Settings to connect your Xero account.",
      link: "/settings",
      category: "setup",
    });
  } else {
    items.push({
      id: "xero-connected",
      title: "Xero connected",
      description: "Your Xero account is linked and syncing data.",
      status: "good",
      category: "setup",
    });
  }

  // Chart of Accounts
  const hasCoa = hasChartOfAccounts(business.id);
  if (!hasCoa) {
    items.push({
      id: "coa-setup",
      title: "Set up Chart of Accounts",
      description:
        "A chart of accounts is how your business organises money — think of it as folders for income, expenses, assets, and debts. We can set up a standard NZ one for you.",
      status: "action_needed",
      action: "Visit Chart of Accounts to set up your accounts.",
      link: "/settings/chart-of-accounts",
      category: "setup",
    });
  } else {
    items.push({
      id: "coa-setup",
      title: "Chart of Accounts set up",
      description: "Your accounts are set up and ready for bookkeeping.",
      status: "good",
      category: "setup",
    });
  }

  // --- COMPLIANCE CHECKS ---

  // Upcoming deadlines (next 14 days)
  const twoWeeks = new Date(now);
  twoWeeks.setDate(twoWeeks.getDate() + 14);

  const deadlines = calculateDeadlines({
    entity_type: business.entity_type as
      | "company"
      | "sole_trader"
      | "partnership"
      | "trust",
    balance_date: business.balance_date,
    gst_registered: business.gst_registered,
    gst_filing_period: business.gst_filing_period as
      | "monthly"
      | "2monthly"
      | "6monthly"
      | undefined,
    has_employees: business.has_employees,
    paye_frequency: business.paye_frequency as
      | "monthly"
      | "twice_monthly"
      | undefined,
    provisional_tax_method: business.provisional_tax_method as
      | "standard"
      | "estimation"
      | "aim"
      | undefined,
    dateRange: { from: now, to: twoWeeks },
  });

  if (deadlines.length > 0) {
    const nearest = deadlines[0];
    const daysUntil = Math.ceil(
      (new Date(nearest.dueDate).getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    items.push({
      id: "upcoming-deadline",
      title: `${nearest.description} due in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
      description: `You have ${deadlines.length} tax deadline${deadlines.length === 1 ? "" : "s"} in the next 2 weeks. Missing a deadline can mean late filing penalties from IRD.`,
      status: daysUntil <= 3 ? "action_needed" : "warning",
      action: "Check your Deadlines page to see what's due.",
      link: "/deadlines",
      category: "compliance",
    });
  } else {
    items.push({
      id: "upcoming-deadline",
      title: "No deadlines in the next 2 weeks",
      description: "You're all clear on tax deadlines for now.",
      status: "good",
      category: "compliance",
    });
  }

  // --- BOOKKEEPING CHECKS ---

  // Xero data freshness (if connected)
  if (xeroConn.length > 0) {
    const cache = db
      .select()
      .from(schema.xeroCache)
      .where(eq(schema.xeroCache.business_id, business.id))
      .all();

    if (cache.length > 0) {
      const lastSync = new Date(
        Math.max(...cache.map((c) => c.synced_at.getTime()))
      );
      const hoursSince =
        (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);

      if (hoursSince > 24) {
        items.push({
          id: "data-freshness",
          title: "Data is more than a day old",
          description:
            "Your financial data hasn't been synced from Xero recently. The numbers on your dashboard may be out of date.",
          status: "warning",
          action: "Sync your data from the Settings page.",
          link: "/settings",
          category: "bookkeeping",
        });
      } else {
        items.push({
          id: "data-freshness",
          title: "Data is up to date",
          description: `Last synced ${Math.round(hoursSince)} hour${Math.round(hoursSince) === 1 ? "" : "s"} ago.`,
          status: "good",
          category: "bookkeeping",
        });
      }
    }
  }

  // Unreconciled bank transactions
  const unreconciledCount = db
    .select()
    .from(schema.bankTransactions)
    .where(
      and(
        eq(schema.bankTransactions.business_id, business.id),
        eq(schema.bankTransactions.reconciliation_status, "unmatched")
      )
    )
    .all().length;

  if (unreconciledCount > 0) {
    items.push({
      id: "bank-reconciliation",
      title: `${unreconciledCount} unreconciled bank transaction${unreconciledCount === 1 ? "" : "s"}`,
      description:
        "Bank reconciliation means checking that every bank transaction matches an entry in your books. Unreconciled transactions could mean missing invoices, uncategorised expenses, or errors.",
      status: unreconciledCount > 20 ? "action_needed" : "warning",
      action: "Review and match transactions on the Reconcile page.",
      link: "/banking/reconcile",
      category: "bookkeeping",
    });
  } else {
    items.push({
      id: "bank-reconciliation",
      title: "Bank transactions reconciled",
      description:
        "All your bank transactions are matched to accounting entries.",
      status: "good",
      category: "bookkeeping",
    });
  }

  // --- MONITORING CHECKS ---

  // Anomalies
  const newAnomalies = db
    .select()
    .from(schema.anomalies)
    .where(
      and(
        eq(schema.anomalies.business_id, business.id),
        eq(schema.anomalies.status, "new")
      )
    )
    .all().length;

  if (newAnomalies > 0) {
    items.push({
      id: "anomalies",
      title: `${newAnomalies} item${newAnomalies === 1 ? "" : "s"} flagged for review`,
      description:
        "We automatically check your financial data for unusual patterns — large changes, missing information, or things that don't add up. These need your attention.",
      status: "warning",
      action: "Review flagged items on the Crosscheck page.",
      link: "/crosscheck",
      category: "monitoring",
    });
  } else {
    items.push({
      id: "anomalies",
      title: "No flagged items",
      description: "Nothing unusual detected in your recent financial data.",
      status: "good",
      category: "monitoring",
    });
  }

  // Overdue invoices
  const todayStr = now.toISOString().slice(0, 10);
  const sentInvoices = db
    .select()
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.business_id, business.id),
        eq(schema.invoices.status, "sent")
      )
    )
    .all();
  const overdueInvoices = sentInvoices.filter(
    (inv) => inv.due_date && inv.due_date < todayStr
  );

  if (overdueInvoices.length > 0) {
    items.push({
      id: "overdue-invoices",
      title: `${overdueInvoices.length} overdue invoice${overdueInvoices.length === 1 ? "" : "s"}`,
      description:
        "These invoices are past their due date and haven't been paid. Late payments affect your cash flow — the money your business has available to spend.",
      status: "action_needed",
      action: "Follow up with your customers or check the Invoices page.",
      link: "/invoices",
      category: "monitoring",
    });
  } else {
    items.push({
      id: "overdue-invoices",
      title: "No overdue invoices",
      description: "All sent invoices are within their payment terms.",
      status: "good",
      category: "monitoring",
    });
  }

  return items;
}

/** Returns a score from 0-100 based on health check results */
export function calculateHealthScore(items: HealthCheckItem[]): number {
  if (items.length === 0) return 100;
  const weights: Record<HealthCheckStatus, number> = {
    good: 1,
    warning: 0.5,
    action_needed: 0,
  };
  const total = items.reduce((sum, item) => sum + weights[item.status], 0);
  return Math.round((total / items.length) * 100);
}
