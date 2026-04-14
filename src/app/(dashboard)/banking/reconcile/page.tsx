import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getReconciliationStatus } from "@/lib/ledger/reconciliation";
import { listAccounts, hasChartOfAccounts } from "@/lib/ledger/accounts";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { ReconcileClient } from "./reconcile-client";
import { ExplainButton } from "@/components/explain-button";
import { SetPageContext } from "@/components/page-context-provider";
import { PAGE_CONTEXTS } from "@/lib/help/page-context";

export default async function ReconcilePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/onboarding");

  const businessId = session.activeBusiness.id;

  if (!hasChartOfAccounts(businessId)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Bank Reconciliation</h1>
        <p className="text-muted-foreground">
          Set up your Chart of Accounts first. Go to Settings to seed the default NZ COA.
        </p>
      </div>
    );
  }

  const db = getDb();

  // Check if there are any bank transactions
  const txnCount = db
    .select({ id: schema.bankTransactions.id })
    .from(schema.bankTransactions)
    .where(eq(schema.bankTransactions.business_id, businessId))
    .limit(1)
    .all();

  if (txnCount.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Bank Reconciliation</h1>
        <p className="text-muted-foreground">
          No bank transactions to reconcile. Connect a business bank account via{" "}
          <a href="/settings/bank-feeds" className="text-primary hover:underline">
            Settings → Bank Feeds
          </a>{" "}
          and sync your transactions first.
        </p>
      </div>
    );
  }

  const status = getReconciliationStatus(businessId);
  const accounts = listAccounts(businessId);

  // Get bank accounts for filter
  const bankAccounts = db
    .select()
    .from(schema.akahuAccounts)
    .where(eq(schema.akahuAccounts.linked_business_id, businessId))
    .all()
    .map((a) => ({ id: a.id, name: decrypt(a.name), institution: decrypt(a.institution) }));

  // Get transactions with decrypted fields
  const transactions = db
    .select()
    .from(schema.bankTransactions)
    .where(eq(schema.bankTransactions.business_id, businessId))
    .all()
    .map((t) => ({
      ...t,
      description: decrypt(t.description),
      merchant_name: t.merchant_name ? decrypt(t.merchant_name) : null,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const reconContext = {
    ...PAGE_CONTEXTS["banking/reconcile"],
    dataSummary: `${status.unmatched} unmatched, ${status.matched} matched, ${status.reconciled} reconciled out of ${status.totalTransactions} total`,
  };

  return (
    <div className="space-y-6">
      <SetPageContext context={reconContext} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bank Reconciliation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Match bank transactions to journal entries
          </p>
        </div>
        <ExplainButton context={reconContext} />
      </div>

      {/* Status summary */}
      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{status.totalTransactions}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Unmatched</p>
          <p className="text-2xl font-bold text-yellow-500">{status.unmatched}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Matched</p>
          <p className="text-2xl font-bold text-blue-500">{status.matched}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Reconciled</p>
          <p className="text-2xl font-bold text-green-500">{status.reconciled}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Bank vs Ledger</p>
          <p className="text-2xl font-bold">
            {status.bankBalance != null
              ? `$${Math.abs(status.bankBalance - status.ledgerBalance).toFixed(2)}`
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {status.bankBalance != null
              ? Math.abs(status.bankBalance - status.ledgerBalance) < 1
                ? "Balanced"
                : "Variance"
              : "No bank data"}
          </p>
        </div>
      </div>

      <ReconcileClient
        transactions={transactions}
        accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type }))}
        bankAccounts={bankAccounts}
      />
    </div>
  );
}
