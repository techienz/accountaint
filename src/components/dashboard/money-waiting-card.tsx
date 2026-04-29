import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

function formatNzd(value: number): string {
  return value.toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type MoneyWaitingProps = {
  uninvoicedEarnings: number;
  uninvoicedHours: number;
  invoicedUnpaid: number;
  overdueCount: number;
  oldestUnpaidDays: number | null;
};

export function MoneyWaitingCard({
  uninvoicedEarnings,
  uninvoicedHours,
  invoicedUnpaid,
  overdueCount,
  oldestUnpaidDays,
}: MoneyWaitingProps) {
  const total = uninvoicedEarnings + invoicedUnpaid;
  const hasAnything = total > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Money Waiting</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasAnything ? (
          <p className="text-sm text-muted-foreground">
            Nothing waiting — all earned work is on a paid invoice.
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Total waiting</span>
              <span className="text-2xl font-semibold tabular-nums">
                ${formatNzd(total)}
              </span>
            </div>
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <Link
                  href="/timesheets"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Uninvoiced work
                  {uninvoicedHours > 0 && (
                    <span className="ml-1 text-xs">({uninvoicedHours}h)</span>
                  )}
                </Link>
                <span className="font-medium tabular-nums">
                  ${formatNzd(uninvoicedEarnings)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <Link
                  href="/invoices"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Invoiced unpaid
                  {overdueCount > 0 && (
                    <span className="ml-1 text-xs text-red-600 dark:text-red-400">
                      ({overdueCount} overdue)
                    </span>
                  )}
                </Link>
                <span className="font-medium tabular-nums">
                  ${formatNzd(invoicedUnpaid)}
                </span>
              </div>
            </div>
            {oldestUnpaidDays !== null && oldestUnpaidDays > 0 && (
              <div className="border-t pt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>Oldest unpaid: {oldestUnpaidDays} days</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
