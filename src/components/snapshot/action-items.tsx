import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type BankAccountAction = {
  name: string;
  institution: string;
  balance: number;
  unmatchedCount: number;
  lastSynced: string | null;
  source: "akahu" | "xero";
};

export type ActionItemsData = {
  bankAccounts: BankAccountAction[];
  draftExpenses: number;
  overdueInvoices: { count: number; total: number };
  billsDueThisWeek: { count: number; total: number };
  nextDeadline: { label: string; date: string } | null;
  needsDepreciation: boolean;
  needsOpeningBalances: boolean;
  minWageIssues: number;
  kiwisaverIssues: number;
  prescribedInterestDue: Array<{ name: string; amount: number }>;
  regulatoryUpdates: number;
  taxOptimisationSavings: number;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(n);

export function ActionItems({ data }: { data: ActionItemsData }) {
  const items: Array<{
    label: string;
    detail?: string;
    href: string;
    variant: "default" | "warning" | "info" | "setup" | "success";
  }> = [];

  // Bank accounts — show all, unmatched first
  const sortedAccounts = [...data.bankAccounts].sort((a, b) => b.unmatchedCount - a.unmatchedCount);
  for (const acct of sortedAccounts) {
    if (acct.source === "xero") {
      items.push({
        label: `${acct.name}`,
        detail: "Managed in Xero",
        href: "/reports/bank-summary",
        variant: "info",
      });
    } else if (acct.unmatchedCount > 0) {
      items.push({
        label: `${acct.name} (${acct.institution})`,
        detail: `${acct.unmatchedCount} transaction${acct.unmatchedCount === 1 ? "" : "s"} to reconcile · Balance: ${fmt(acct.balance)}`,
        href: "/banking/reconcile",
        variant: "default",
      });
    } else {
      items.push({
        label: `${acct.name} (${acct.institution})`,
        detail: `All reconciled · Balance: ${fmt(acct.balance)}`,
        href: "/banking/reconcile",
        variant: "success",
      });
    }
  }

  if (data.draftExpenses > 0) {
    items.push({
      label: `${data.draftExpenses} expense${data.draftExpenses === 1 ? "" : "s"} to review`,
      href: "/expenses",
      variant: "default",
    });
  }

  if (data.overdueInvoices.count > 0) {
    items.push({
      label: `${data.overdueInvoices.count} overdue invoice${data.overdueInvoices.count === 1 ? "" : "s"}`,
      detail: fmt(data.overdueInvoices.total),
      href: "/invoices",
      variant: "warning",
    });
  }

  if (data.billsDueThisWeek.count > 0) {
    items.push({
      label: `${data.billsDueThisWeek.count} bill${data.billsDueThisWeek.count === 1 ? "" : "s"} due this week`,
      detail: fmt(data.billsDueThisWeek.total),
      href: "/invoices",
      variant: "warning",
    });
  }

  if (data.nextDeadline) {
    items.push({
      label: data.nextDeadline.label,
      detail: data.nextDeadline.date,
      href: "/deadlines",
      variant: "info",
    });
  }

  if (data.needsDepreciation) {
    items.push({
      label: "Run annual depreciation",
      detail: "Assets exist but depreciation hasn't been run this tax year",
      href: "/assets",
      variant: "setup",
    });
  }

  if (data.needsOpeningBalances) {
    items.push({
      label: "Set up opening balances",
      detail: "Get accurate reports by entering your starting position",
      href: "/settings/opening-balances",
      variant: "setup",
    });
  }

  if (data.minWageIssues > 0) {
    items.push({
      label: `${data.minWageIssues} employee${data.minWageIssues === 1 ? "" : "s"} below minimum wage`,
      href: "/employees",
      variant: "warning",
    });
  }

  if (data.kiwisaverIssues > 0) {
    items.push({
      label: `${data.kiwisaverIssues} employee${data.kiwisaverIssues === 1 ? "" : "s"} with KiwiSaver employer rate below 3.5%`,
      href: "/employees",
      variant: "warning",
    });
  }

  for (const pi of data.prescribedInterestDue) {
    items.push({
      label: `Prescribed interest: ${fmt(pi.amount)} due for ${pi.name}`,
      detail: "Charge interest to avoid deemed dividend treatment",
      href: "/shareholders",
      variant: "warning",
    });
  }

  if (data.regulatoryUpdates > 0) {
    items.push({
      label: `${data.regulatoryUpdates} regulatory update${data.regulatoryUpdates > 1 ? "s" : ""} need review`,
      detail: "Tax rules may have changed — review and apply",
      href: "/settings/regulatory-updates",
      variant: "warning",
    });
  }

  if (data.taxOptimisationSavings > 0) {
    items.push({
      label: `Tax optimisation: ${fmt(data.taxOptimisationSavings)} potential savings found`,
      detail: "Review and apply strategies to reduce your tax",
      href: "/tax-optimisation",
      variant: "success",
    });
  }

  const variantStyles = {
    default: "border-l-primary",
    warning: "border-l-amber-500",
    info: "border-l-blue-500",
    success: "border-l-green-500",
    setup: "border-l-muted-foreground",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Action Items</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length > 0 ? (
          items.map((item, i) => (
            <Link
              key={i}
              href={item.href}
              className={`flex items-center justify-between rounded-md border-l-4 px-3 py-2 hover:bg-muted/50 transition-colors ${variantStyles[item.variant]}`}
            >
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                {item.detail && (
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                )}
              </div>
              <span className="text-muted-foreground text-xs">→</span>
            </Link>
          ))
        ) : (
          <p className="text-sm text-muted-foreground py-2">
            All caught up — nothing needs your attention right now.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
