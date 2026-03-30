import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

function formatNzd(value: number): string {
  return "$" + value.toLocaleString("en-NZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function ReceivablesCard({
  totalOutstanding,
  overdueCount,
  overdueTotal,
  avgCollectionDays,
}: {
  totalOutstanding: number;
  overdueCount: number;
  overdueTotal: number;
  avgCollectionDays: number | null;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between mb-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
            Accounts Receivable
          </p>
          <Link
            href="/reports/aging"
            className="text-[11px] text-primary hover:underline"
          >
            View aging
          </Link>
        </div>
        <p className="text-2xl font-bold tabular-nums mb-3">{formatNzd(totalOutstanding)}</p>
        <div className="space-y-2">
          {overdueCount > 0 && (
            <div className="flex items-center justify-between rounded-md bg-amber-500/8 px-2.5 py-1.5">
              <span className="text-xs font-medium text-amber-600">
                {overdueCount} overdue
              </span>
              <span className="text-xs font-semibold tabular-nums text-amber-600">{formatNzd(overdueTotal)}</span>
            </div>
          )}
          {avgCollectionDays != null && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Avg collection</span>
              <span className="text-sm font-medium tabular-nums">{avgCollectionDays} days</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
