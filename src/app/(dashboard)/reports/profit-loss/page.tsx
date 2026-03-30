import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { fetchXeroReport } from "@/lib/xero/reports";
import { getPresetPeriod, type PresetPeriod } from "@/lib/reports/periods";
import { ReportHeader } from "@/components/reports/report-header";
import { DateRangePicker } from "@/components/reports/date-range-picker";
import { XeroReportTable } from "@/components/reports/xero-report-table";
import { Card, CardContent } from "@/components/ui/card";
import type { XeroReport } from "@/lib/xero/types";

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
      from: new Date(new Date().getFullYear(), 3, 1).toISOString().slice(0, 10),
      to: new Date().toISOString().slice(0, 10),
    };
  }

  const { data, fromCache } = await fetchXeroReport(biz.id, "ProfitAndLoss", {
    fromDate: dateRange.from,
    toDate: dateRange.to,
  });

  const report = (data as { Reports?: XeroReport[] })?.Reports?.[0] || null;

  return (
    <>
      <ReportHeader
        title="Profit & Loss"
        dateRange={dateRange}
        fromCache={fromCache}
      />
      <div data-print-hidden>
        <DateRangePicker basePath="/reports/profit-loss" balanceDate={biz.balance_date} />
      </div>
      <Card>
        <CardContent className="pt-6">
          {report ? (
            <XeroReportTable report={report} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No data available. Connect Xero and sync to see your Profit & Loss report.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
