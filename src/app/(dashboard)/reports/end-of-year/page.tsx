import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { generateProfitAndLoss } from "@/lib/ledger/reports/profit-loss";
import { generateBalanceSheet } from "@/lib/ledger/reports/balance-sheet";
import { ReportHeader } from "@/components/reports/report-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNzd } from "@/lib/reports/parsers";
import { formatDateNZ } from "@/lib/utils/dates";

function getTaxYearDates(balanceDate: string): { from: string; to: string; label: string } {
  const [mm, dd] = balanceDate.split("-").map(Number);
  const now = new Date();
  const balThisYear = new Date(now.getFullYear(), mm - 1, dd);

  let yearEnd: Date;
  if (now > balThisYear) {
    yearEnd = balThisYear;
  } else {
    yearEnd = new Date(now.getFullYear() - 1, mm - 1, dd);
  }

  const yearStart = new Date(yearEnd.getFullYear() - 1, mm - 1, dd + 1);
  const label = `${yearStart.getFullYear()}/${yearEnd.getFullYear()}`;

  return { from: formatDateNZ(yearStart), to: formatDateNZ(yearEnd), label };
}

export default async function EndOfYearPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/settings?new=true");

  const biz = session.activeBusiness;
  const { from, to, label } = getTaxYearDates(biz.balance_date);

  const [plReport, bsReport] = await Promise.all([
    Promise.resolve(generateProfitAndLoss(biz.id, from, to)),
    Promise.resolve(generateBalanceSheet(biz.id, to)),
  ]);

  const hasPlData =
    plReport.revenue.accounts.length > 0 || plReport.expenses.accounts.length > 0;
  const hasBsData =
    bsReport.assets.accounts.length > 0 ||
    bsReport.liabilities.accounts.length > 0 ||
    bsReport.equity.accounts.length > 0;

  return (
    <>
      <ReportHeader
        title={`End of Year — ${label}`}
        dateRange={{ from, to }}
      />

      {/* Profit & Loss */}
      <Card>
        <CardHeader>
          <CardTitle>Profit & Loss</CardTitle>
        </CardHeader>
        <CardContent>
          {hasPlData ? (
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td colSpan={2} className="py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wide">Revenue</td>
                </tr>
                {plReport.revenue.accounts.map((a) => (
                  <tr key={a.code}>
                    <td className="py-1 pl-4 text-muted-foreground">{a.name}</td>
                    <td className="py-1 text-right">${formatNzd(a.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t font-medium">
                  <td className="py-2 pl-4">Total Revenue</td>
                  <td className="py-2 text-right">${formatNzd(plReport.revenue.total)}</td>
                </tr>

                {plReport.costOfGoodsSold.accounts.length > 0 && (
                  <>
                    <tr className="border-b mt-2">
                      <td colSpan={2} className="py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wide">Cost of Goods Sold</td>
                    </tr>
                    {plReport.costOfGoodsSold.accounts.map((a) => (
                      <tr key={a.code}>
                        <td className="py-1 pl-4 text-muted-foreground">{a.name}</td>
                        <td className="py-1 text-right">${formatNzd(a.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t font-medium">
                      <td className="py-2 pl-4">Total COGS</td>
                      <td className="py-2 text-right">${formatNzd(plReport.costOfGoodsSold.total)}</td>
                    </tr>
                    <tr className="border-t font-semibold">
                      <td className="py-2 pl-4">Gross Profit</td>
                      <td className="py-2 text-right">${formatNzd(plReport.grossProfit)}</td>
                    </tr>
                  </>
                )}

                <tr className="border-b mt-2">
                  <td colSpan={2} className="py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wide">Expenses</td>
                </tr>
                {plReport.expenses.accounts.map((a) => (
                  <tr key={a.code}>
                    <td className="py-1 pl-4 text-muted-foreground">{a.name}</td>
                    <td className="py-1 text-right">${formatNzd(a.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t font-medium">
                  <td className="py-2 pl-4">Total Expenses</td>
                  <td className="py-2 text-right">${formatNzd(plReport.expenses.total)}</td>
                </tr>

                <tr className="border-t-2 font-bold text-base">
                  <td className="py-3">Net Profit</td>
                  <td className={`py-3 text-right ${plReport.netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    ${formatNzd(plReport.netProfit)}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">No P&amp;L data recorded for this period.</p>
          )}
        </CardContent>
      </Card>

      <div data-print-break />

      {/* Balance Sheet */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Balance Sheet</CardTitle>
          {hasBsData && (
            bsReport.isBalanced ? (
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Balanced
              </Badge>
            ) : (
              <Badge variant="destructive">Out of Balance</Badge>
            )
          )}
        </CardHeader>
        <CardContent>
          {hasBsData ? (
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td colSpan={2} className="py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wide">Assets</td>
                </tr>
                {bsReport.assets.accounts.map((a) => (
                  <tr key={a.code}>
                    <td className="py-1 pl-4 text-muted-foreground">{a.name}</td>
                    <td className="py-1 text-right">${formatNzd(a.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t font-semibold">
                  <td className="py-2 pl-4">Total Assets</td>
                  <td className="py-2 text-right">${formatNzd(bsReport.totalAssets)}</td>
                </tr>

                <tr className="border-b mt-4">
                  <td colSpan={2} className="py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wide">Liabilities</td>
                </tr>
                {bsReport.liabilities.accounts.map((a) => (
                  <tr key={a.code}>
                    <td className="py-1 pl-4 text-muted-foreground">{a.name}</td>
                    <td className="py-1 text-right">${formatNzd(a.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t font-medium">
                  <td className="py-2 pl-4">Total Liabilities</td>
                  <td className="py-2 text-right">${formatNzd(bsReport.liabilities.total)}</td>
                </tr>

                <tr className="border-b mt-4">
                  <td colSpan={2} className="py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wide">Equity</td>
                </tr>
                {bsReport.equity.accounts.map((a) => (
                  <tr key={a.code}>
                    <td className="py-1 pl-4 text-muted-foreground">{a.name}</td>
                    <td className="py-1 text-right">${formatNzd(a.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t font-medium">
                  <td className="py-2 pl-4">Total Equity</td>
                  <td className="py-2 text-right">${formatNzd(bsReport.equity.total)}</td>
                </tr>

                <tr className="border-t-2 font-bold text-base">
                  <td className="py-3">Total Liabilities + Equity</td>
                  <td className="py-3 text-right">${formatNzd(bsReport.totalLiabilitiesAndEquity)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">No Balance Sheet data recorded for this period.</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
