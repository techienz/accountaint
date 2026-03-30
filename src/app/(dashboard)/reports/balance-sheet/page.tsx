import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { fetchXeroReport } from "@/lib/xero/reports";
import { getPresetPeriod, type PresetPeriod } from "@/lib/reports/periods";
import { ReportHeader } from "@/components/reports/report-header";
import { DateRangePicker } from "@/components/reports/date-range-picker";
import { XeroReportTable } from "@/components/reports/xero-report-table";
import { Card, CardContent } from "@/components/ui/card";
import type { XeroReport } from "@/lib/xero/types";

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
    toDate = range?.to || new Date().toISOString().slice(0, 10);
  }

  const { data, fromCache } = await fetchXeroReport(biz.id, "BalanceSheet", {
    date: toDate,
  });

  const report = (data as { Reports?: XeroReport[] })?.Reports?.[0] || null;

  return (
    <>
      <ReportHeader
        title="Balance Sheet"
        dateRange={{ from: "As at", to: toDate }}
        fromCache={fromCache}
      />
      <div data-print-hidden>
        <DateRangePicker basePath="/reports/balance-sheet" balanceDate={biz.balance_date} />
      </div>
      <Card>
        <CardContent className="pt-6">
          {report ? (
            <XeroReportTable report={report} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No data available. Connect Xero and sync to see your Balance Sheet.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
