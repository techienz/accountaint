import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listAccounts, hasChartOfAccounts, seedChartOfAccounts } from "@/lib/ledger/accounts";
import { CoaClient } from "./coa-client";
import { ExplainButton } from "@/components/explain-button";
import { SetPageContext } from "@/components/page-context-provider";
import { PAGE_CONTEXTS } from "@/lib/help/page-context";

export default async function ChartOfAccountsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/onboarding");

  const businessId = session.activeBusiness.id;
  const hasCoa = hasChartOfAccounts(businessId);

  if (!hasCoa) {
    // Auto-seed for existing businesses that don't have COA yet
    seedChartOfAccounts(businessId);
  }

  const accounts = listAccounts(businessId);

  // Group by type
  const grouped = {
    asset: accounts.filter((a) => a.type === "asset"),
    liability: accounts.filter((a) => a.type === "liability"),
    equity: accounts.filter((a) => a.type === "equity"),
    revenue: accounts.filter((a) => a.type === "revenue"),
    expense: accounts.filter((a) => a.type === "expense"),
  };

  const coaContext = PAGE_CONTEXTS["settings/chart-of-accounts"];

  return (
    <div className="space-y-6">
      <SetPageContext context={coaContext} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chart of Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your business account structure. System accounts cannot be deleted.
          </p>
        </div>
        <ExplainButton context={coaContext} />
      </div>

      <CoaClient grouped={grouped} businessId={businessId} />
    </div>
  );
}
