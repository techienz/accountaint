import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { fetchXeroReport } from "@/lib/xero/reports";
import { ReportHeader } from "@/components/reports/report-header";
import { XeroReportTable } from "@/components/reports/xero-report-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { XeroReport } from "@/lib/xero/types";

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

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const label = `${yearStart.getFullYear()}/${yearEnd.getFullYear()}`;

  return { from: fmt(yearStart), to: fmt(yearEnd), label };
}

export default async function EndOfYearPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/settings?new=true");

  const biz = session.activeBusiness;
  const { from, to, label } = getTaxYearDates(biz.balance_date);

  const [plResult, bsResult] = await Promise.all([
    fetchXeroReport(biz.id, "ProfitAndLoss", { fromDate: from, toDate: to }),
    fetchXeroReport(biz.id, "BalanceSheet", { date: to }),
  ]);

  const plReport = (plResult.data as { Reports?: XeroReport[] })?.Reports?.[0] || null;
  const bsReport = (bsResult.data as { Reports?: XeroReport[] })?.Reports?.[0] || null;
  const fromCache = plResult.fromCache || bsResult.fromCache;

  return (
    <>
      <ReportHeader
        title={`End of Year — ${label}`}
        dateRange={{ from, to }}
        fromCache={fromCache}
      />

      <Card>
        <CardHeader>
          <CardTitle>Profit & Loss</CardTitle>
        </CardHeader>
        <CardContent>
          {plReport ? (
            <XeroReportTable report={plReport} />
          ) : (
            <p className="text-sm text-muted-foreground">No P&L data available.</p>
          )}
        </CardContent>
      </Card>

      <div data-print-break />

      <Card>
        <CardHeader>
          <CardTitle>Balance Sheet</CardTitle>
        </CardHeader>
        <CardContent>
          {bsReport ? (
            <XeroReportTable report={bsReport} />
          ) : (
            <p className="text-sm text-muted-foreground">No Balance Sheet data available.</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
