import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { generateBalanceSheet } from "@/lib/ledger/reports/balance-sheet";
import { getPresetPeriod, type PresetPeriod } from "@/lib/reports/periods";
import { ReportHeader } from "@/components/reports/report-header";
import { DateRangePicker } from "@/components/reports/date-range-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExplainButton } from "@/components/explain-button";
import { SetPageContext } from "@/components/page-context-provider";
import { PAGE_CONTEXTS } from "@/lib/help/page-context";
import { todayNZ } from "@/lib/utils/dates";
import { formatNzd } from "@/lib/reports/parsers";

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/settings?new=true");

  const params = await searchParams;
  const biz = session.activeBusiness;
  const preset = (params.preset || "ytd") as PresetPeriod;

  let toDate: string;
  if (preset === "custom" && params.to) {
    toDate = params.to;
  } else {
    const range = getPresetPeriod(preset, biz.balance_date);
    toDate = range?.to || todayNZ();
  }

  const report = generateBalanceSheet(biz.id, toDate);
  const hasData =
    report.assets.accounts.length > 0 ||
    report.liabilities.accounts.length > 0 ||
    report.equity.accounts.length > 0;

  const bsContext = {
    ...PAGE_CONTEXTS["reports/balance-sheet"],
  };

  return (
    <>
      <SetPageContext context={bsContext} />
      <div className="flex items-center justify-between mb-2">
        <ReportHeader
          title="Balance Sheet"
          dateRange={{ from: "As at", to: toDate }}
        />
        <ExplainButton context={bsContext} />
      </div>
      <div data-print-hidden>
        <DateRangePicker basePath="/reports/balance-sheet" balanceDate={biz.balance_date} />
      </div>
      <Card>
        <CardContent className="pt-6">
          {hasData ? (
            <>
              <div className="flex justify-end mb-4">
                {report.isBalanced ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    Balanced
                  </Badge>
                ) : (
                  <Badge variant="destructive">Out of Balance</Badge>
                )}
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {/* Assets */}
                  <tr className="border-b">
                    <td colSpan={2} className="py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wide">
                      Assets
                    </td>
                  </tr>
                  {report.assets.accounts.map((a) => (
                    <tr key={a.code}>
                      <td className="py-1 pl-4 text-muted-foreground">{a.name}</td>
                      <td className="py-1 text-right">${formatNzd(a.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t font-semibold">
                    <td className="py-2 pl-4">Total Assets</td>
                    <td className="py-2 text-right">${formatNzd(report.totalAssets)}</td>
                  </tr>

                  {/* Liabilities */}
                  <tr className="border-b mt-4">
                    <td colSpan={2} className="py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wide">
                      Liabilities
                    </td>
                  </tr>
                  {report.liabilities.accounts.map((a) => (
                    <tr key={a.code}>
                      <td className="py-1 pl-4 text-muted-foreground">{a.name}</td>
                      <td className="py-1 text-right">${formatNzd(a.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t font-medium">
                    <td className="py-2 pl-4">Total Liabilities</td>
                    <td className="py-2 text-right">${formatNzd(report.liabilities.total)}</td>
                  </tr>

                  {/* Equity */}
                  <tr className="border-b mt-4">
                    <td colSpan={2} className="py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wide">
                      Equity
                    </td>
                  </tr>
                  {report.equity.accounts.map((a) => (
                    <tr key={a.code}>
                      <td className="py-1 pl-4 text-muted-foreground">{a.name}</td>
                      <td className="py-1 text-right">${formatNzd(a.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t font-medium">
                    <td className="py-2 pl-4">Total Equity</td>
                    <td className="py-2 text-right">${formatNzd(report.equity.total)}</td>
                  </tr>

                  {/* Total Liabilities + Equity */}
                  <tr className="border-t-2 font-bold text-base">
                    <td className="py-3">Total Liabilities + Equity</td>
                    <td className="py-3 text-right">${formatNzd(report.totalLiabilitiesAndEquity)}</td>
                  </tr>
                </tbody>
              </table>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No transactions recorded yet. Add journal entries or post invoices to see your Balance Sheet.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
