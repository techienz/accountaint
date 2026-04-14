import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasChartOfAccounts } from "@/lib/ledger/accounts";
import { getExistingOpeningBalance } from "@/lib/ledger/opening-balance";
import { OpeningBalancesClient } from "./opening-balances-client";

export default async function OpeningBalancesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/settings?new=true");

  const businessId = session.activeBusiness.id;
  const hasCoa = hasChartOfAccounts(businessId);
  const existing = getExistingOpeningBalance(businessId);

  return (
    <div className="mx-auto max-w-2xl">
      <OpeningBalancesClient
        hasCoa={hasCoa}
        hasExisting={!!existing}
        existingDate={existing?.date ?? null}
      />
    </div>
  );
}
