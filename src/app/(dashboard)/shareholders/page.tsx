import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { shareholders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { getRunningBalance } from "@/lib/shareholders/balance";
import { getNzTaxYear } from "@/lib/tax/rules";
import { BalanceCard } from "@/components/shareholders/balance-card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { ExplainButton } from "@/components/explain-button";
import { SetPageContext } from "@/components/page-context-provider";
import { PAGE_CONTEXTS } from "@/lib/help/page-context";

export default async function ShareholdersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const business = session.activeBusiness;
  if (!business) redirect("/onboarding");

  const db = getDb();
  const rows = await db
    .select()
    .from(shareholders)
    .where(eq(shareholders.business_id, business.id));

  const taxYear = String(getNzTaxYear(new Date()));

  const shareholderData = await Promise.all(
    rows.map(async (s) => {
      const balance = await getRunningBalance(s.id, taxYear, business.id);
      return {
        ...s,
        name: decrypt(s.name),
        balance: balance.closingBalance,
        isOverdrawn: balance.isOverdrawn,
      };
    })
  );

  const shContext = PAGE_CONTEXTS.shareholders;

  return (
    <div className="space-y-6">
      <SetPageContext context={shContext} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shareholders</h1>
          <p className="text-muted-foreground">
            Current account balances for {taxYear} tax year
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExplainButton context={shContext} />
          <Link href="/shareholders/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Shareholder
            </Button>
          </Link>
        </div>
      </div>

      {shareholderData.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <p>No shareholders added yet.</p>
          <p className="text-sm">
            Add shareholders to track current account balances, drawings, and
            salary/dividend allocations.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shareholderData.map((s) => (
            <Link key={s.id} href={`/shareholders/${s.id}`}>
              <BalanceCard
                name={s.name}
                balance={s.balance}
                isOverdrawn={s.isOverdrawn}
                ownershipPercentage={s.ownership_percentage}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
