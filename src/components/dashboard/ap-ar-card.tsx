import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

type ApArProps = {
  totalReceivable: number;
  totalPayable: number;
  overdueCount: number;
  hasData: boolean;
};

function formatNzd(value: number): string {
  return value.toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ApArCard({ totalReceivable, totalPayable, overdueCount, hasData }: ApArProps) {
  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">AP/AR</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No invoices yet. <Link href="/invoices" className="text-primary hover:underline">Create an invoice</Link> to start tracking receivables.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">AP/AR</CardTitle>
        <Link
          href="/reports/aging"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          View report
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Receivable</span>
          <span className="font-medium text-green-600">
            ${formatNzd(totalReceivable)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Payable</span>
          <span className="font-medium text-red-600">
            ${formatNzd(totalPayable)}
          </span>
        </div>
        {overdueCount > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs text-amber-600">
              {overdueCount} overdue invoice{overdueCount > 1 ? "s" : ""}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
