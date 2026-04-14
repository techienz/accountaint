import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasXeroConnection } from "@/lib/xero/status";
import { compareWithXero, compareBalanceSheet } from "@/lib/ledger/compare";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNzd } from "@/lib/reports/parsers";
import { todayNZ } from "@/lib/utils/dates";

function getVarianceColor(variance: number): string {
  const abs = Math.abs(variance);
  if (abs < 1) return "text-green-600 dark:text-green-400";
  if (abs <= 100) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getVarianceBadge(variance: number) {
  const abs = Math.abs(variance);
  if (abs < 1)
    return <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Aligned</Badge>;
  if (abs <= 100)
    return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">Minor</Badge>;
  return <Badge variant="destructive">Variance</Badge>;
}

export default async function ComparisonPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/settings?new=true");

  const businessId = session.activeBusiness.id;

  // This report requires a Xero connection — show a gate if not connected
  const xeroConnected = hasXeroConnection(businessId);

  if (!xeroConnected) {
    return (
      <>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ledger vs Xero Comparison</h1>
            <p className="text-sm text-muted-foreground">
              Compare your local ledger against Xero data
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              This report compares ledger data with Xero. Connect Xero in{" "}
              <a href="/settings/xero" className="underline">
                Settings
              </a>{" "}
              to use this report.
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  // Current NZ tax year: April 1 to March 31
  const today = new Date();
  const year =
    today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const from = `${year}-04-01`;
  const to = todayNZ();

  const plComparison = compareWithXero(businessId, from, to);
  const bsComparison = compareBalanceSheet(businessId, to);

  const noLedger = !plComparison.ledger && !bsComparison.ledger;

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Ledger vs Xero Comparison
          </h1>
          <p className="text-sm text-muted-foreground">
            {from} to {to} (current tax year)
          </p>
        </div>
        {plComparison.isAligned && bsComparison.isAligned && (
          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
            All Aligned
          </Badge>
        )}
      </div>

      {noLedger && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Ledger not available. Run the backfill from{" "}
              <a href="/settings" className="underline">
                Settings
              </a>{" "}
              to generate journal entries, or import opening balances from{" "}
              <a href="/settings/migration" className="underline">
                Migration
              </a>
              .
            </p>
          </CardContent>
        </Card>
      )}

      {/* P&L Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Profit & Loss</CardTitle>
        </CardHeader>
        <CardContent>
          {plComparison.ledger || plComparison.xero ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Metric</th>
                    <th className="pb-2 font-medium text-right">Ledger</th>
                    <th className="pb-2 font-medium text-right">Xero</th>
                    <th className="pb-2 font-medium text-right">Variance</th>
                    <th className="pb-2 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(
                    [
                      ["Revenue", "revenue"],
                      ["Expenses", "expenses"],
                      ["Net Profit", "netProfit"],
                    ] as const
                  ).map(([label, key]) => (
                    <tr key={key}>
                      <td className="py-2 font-medium">{label}</td>
                      <td className="py-2 text-right">
                        {plComparison.ledger
                          ? `$${formatNzd(plComparison.ledger[key])}`
                          : "-"}
                      </td>
                      <td className="py-2 text-right">
                        {plComparison.xero
                          ? `$${formatNzd(plComparison.xero[key])}`
                          : "-"}
                      </td>
                      <td
                        className={`py-2 text-right ${
                          plComparison.variances
                            ? getVarianceColor(plComparison.variances[key])
                            : ""
                        }`}
                      >
                        {plComparison.variances
                          ? `$${formatNzd(plComparison.variances[key])}`
                          : "-"}
                      </td>
                      <td className="py-2 text-right">
                        {plComparison.variances
                          ? getVarianceBadge(plComparison.variances[key])
                          : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No P&L data available from either source.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Balance Sheet Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Balance Sheet</CardTitle>
        </CardHeader>
        <CardContent>
          {bsComparison.ledger || bsComparison.xero ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Metric</th>
                    <th className="pb-2 font-medium text-right">Ledger</th>
                    <th className="pb-2 font-medium text-right">Xero</th>
                    <th className="pb-2 font-medium text-right">Variance</th>
                    <th className="pb-2 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(
                    [
                      ["Total Assets", "totalAssets"],
                      [
                        "Total Liabilities + Equity",
                        "totalLiabilitiesAndEquity",
                      ],
                    ] as const
                  ).map(([label, key]) => (
                    <tr key={key}>
                      <td className="py-2 font-medium">{label}</td>
                      <td className="py-2 text-right">
                        {bsComparison.ledger
                          ? `$${formatNzd(bsComparison.ledger[key])}`
                          : "-"}
                      </td>
                      <td className="py-2 text-right">
                        {bsComparison.xero
                          ? `$${formatNzd(bsComparison.xero[key])}`
                          : "-"}
                      </td>
                      <td
                        className={`py-2 text-right ${
                          bsComparison.variances
                            ? getVarianceColor(bsComparison.variances[key])
                            : ""
                        }`}
                      >
                        {bsComparison.variances
                          ? `$${formatNzd(bsComparison.variances[key])}`
                          : "-"}
                      </td>
                      <td className="py-2 text-right">
                        {bsComparison.variances
                          ? getVarianceBadge(bsComparison.variances[key])
                          : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No balance sheet data available from either source.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
