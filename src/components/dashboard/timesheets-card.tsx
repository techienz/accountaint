import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatNzd(value: number): string {
  return value.toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function TimesheetsCard({
  totalHours,
  billableRatio,
  totalEarnings,
  uninvoicedEarnings,
  uninvoicedHours,
}: {
  totalHours: number;
  billableRatio: number;
  totalEarnings: number;
  uninvoicedEarnings: number;
  uninvoicedHours: number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Timesheets</CardTitle>
        <Link
          href="/timesheets"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Hours this week</span>
          <span className="font-medium">{totalHours}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Billable ratio</span>
          <span className="font-medium">{billableRatio}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Earnings this week</span>
          <span className="font-medium">${formatNzd(totalEarnings)}</span>
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">
            Uninvoiced
            {uninvoicedHours > 0 && (
              <span className="ml-1 text-xs">({uninvoicedHours}h)</span>
            )}
          </span>
          <span className={`font-semibold ${uninvoicedEarnings > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
            ${formatNzd(uninvoicedEarnings)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
