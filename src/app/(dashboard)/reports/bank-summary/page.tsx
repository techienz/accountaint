import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { fetchXeroReport } from "@/lib/xero/reports";
import { ReportHeader } from "@/components/reports/report-header";
import { XeroReportTable } from "@/components/reports/xero-report-table";
import { Card, CardContent } from "@/components/ui/card";
import type { XeroReport } from "@/lib/xero/types";

export default async function BankSummaryPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/settings?new=true");

  const biz = session.activeBusiness;

  const { data, fromCache } = await fetchXeroReport(biz.id, "BankSummary");

  const report = (data as { Reports?: XeroReport[] })?.Reports?.[0] || null;

  return (
    <>
      <ReportHeader title="Bank Summary" fromCache={fromCache} />

      <Card>
        <CardContent className="pt-6">
          {report ? (
            <>
              <XeroReportTable report={report} />
              <p className="text-xs text-muted-foreground mt-4">
                This shows opening/closing balances from Xero. For actual bank
                statement balances, verify directly in your bank or Xero&apos;s bank
                reconciliation.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No data available. Connect Xero to see your bank summary.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
