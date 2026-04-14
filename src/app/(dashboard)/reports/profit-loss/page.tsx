import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { generateProfitAndLoss } from "@/lib/ledger/reports/profit-loss";
import { getPresetPeriod, type PresetPeriod } from "@/lib/reports/periods";
import { ReportHeader } from "@/components/reports/report-header";
import { DateRangePicker } from "@/components/reports/date-range-picker";
import { Card, CardContent } from "@/components/ui/card";
import { ExplainButton } from "@/components/explain-button";
import { SetPageContext } from "@/components/page-context-provider";
import { PAGE_CONTEXTS } from "@/lib/help/page-context";
import { todayNZ, formatDateNZ } from "@/lib/utils/dates";
import { formatNzd } from "@/lib/reports/parsers";

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/settings?new=true");

  const params = await searchParams;
  const biz = session.activeBusiness;
  const preset = (params.preset || "this_tax_year") as PresetPeriod;

  let dateRange: { from: string; to: string };
  if (preset === "custom" && params.from && params.to) {
    dateRange = { from: params.from, to: params.to };
  } else {
    dateRange = getPresetPeriod(preset, biz.balance_date) || {
      from: formatDateNZ(new Date(new Date().getFullYear(), 3, 1)),
      to: todayNZ(),
    };
  }

  const report = generateProfitAndLoss(biz.id, dateRange.from, dateRange.to);
  const hasData =
    report.revenue.accounts.length > 0 || report.expenses.accounts.length > 0;

  const plContext = {
    ...PAGE_CONTEXTS["reports/profit-loss"],
  };

  return (
    <>
      <SetPageContext context={plContext} />
      <div className="flex items-center justify-between mb-2">
        <ReportHeader title="Profit & Loss" dateRange={dateRange} />
        <ExplainButton context={plContext} />
      </div>
      <div data-print-hidden>
        <DateRangePicker basePath="/reports/profit-loss" balanceDate={biz.balance_date} />
      </div>
      <Card>
        <CardContent className="pt-6">
          {hasData ? (
            <table className="w-full text-sm">
              <tbody>
                {/* Revenue */}
                <tr className="border-b">
                  <td colSpan={2} className="py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wide">
                    Revenue
                  </td>
                </tr>
                {report.revenue.accounts.map((a) => (
                  <tr key={a.code}>
                    <td className="py-1 pl-4 text-muted-foreground">{a.name}</td>
                    <td className="py-1 text-right">${formatNzd(a.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t font-medium">
                  <td className="py-2 pl-4">Total Revenue</td>
                  <td className="py-2 text-right">${formatNzd(report.revenue.total)}</td>
                </tr>

                {/* COGS (if any) */}
                {report.costOfGoodsSold.accounts.length > 0 && (
                  <>
                    <tr className="border-b mt-2">
                      <td colSpan={2} className="py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wide">
                        Cost of Goods Sold
                      </td>
                    </tr>
                    {report.costOfGoodsSold.accounts.map((a) => (
                      <tr key={a.code}>
                        <td className="py-1 pl-4 text-muted-foreground">{a.name}</td>
                        <td className="py-1 text-right">${formatNzd(a.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t font-medium">
                      <td className="py-2 pl-4">Total COGS</td>
                      <td className="py-2 text-right">${formatNzd(report.costOfGoodsSold.total)}</td>
                    </tr>
                    <tr className="border-t font-semibold">
                      <td className="py-2 pl-4">Gross Profit</td>
                      <td className="py-2 text-right">${formatNzd(report.grossProfit)}</td>
                    </tr>
                  </>
                )}

                {/* Expenses */}
                <tr className="border-b mt-2">
                  <td colSpan={2} className="py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wide">
                    Expenses
                  </td>
                </tr>
                {report.expenses.accounts.map((a) => (
                  <tr key={a.code}>
                    <td className="py-1 pl-4 text-muted-foreground">{a.name}</td>
                    <td className="py-1 text-right">${formatNzd(a.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t font-medium">
                  <td className="py-2 pl-4">Total Expenses</td>
                  <td className="py-2 text-right">${formatNzd(report.expenses.total)}</td>
                </tr>

                {/* Net Profit */}
                <tr className="border-t-2 font-bold text-base">
                  <td className="py-3">Net Profit</td>
                  <td className={`py-3 text-right ${report.netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    ${formatNzd(report.netProfit)}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No transactions recorded yet. Add journal entries or post invoices to see your Profit &amp; Loss report.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
