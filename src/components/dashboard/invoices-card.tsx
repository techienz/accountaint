import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatNzd(value: number): string {
  return value.toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function InvoicesCard({
  totalReceivable,
  totalPayable,
  overdueCount,
  overdueAmount,
}: {
  totalReceivable: number;
  totalPayable: number;
  overdueCount: number;
  overdueAmount: number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Invoices</CardTitle>
        <Link
          href="/invoices"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Receivable</span>
          <span className="font-medium">${formatNzd(totalReceivable)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Payable</span>
          <span className="font-medium">${formatNzd(totalPayable)}</span>
        </div>
        {overdueCount > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs text-red-600">
              {overdueCount} overdue for ${formatNzd(overdueAmount)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
