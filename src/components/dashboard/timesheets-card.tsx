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
}: {
  totalHours: number;
  billableRatio: number;
  totalEarnings: number;
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
      </CardContent>
    </Card>
  );
}
