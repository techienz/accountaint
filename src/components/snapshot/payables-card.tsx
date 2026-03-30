import { Card, CardContent } from "@/components/ui/card";

function formatNzd(value: number): string {
  return "$" + value.toLocaleString("en-NZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function PayablesCard({
  totalOutstanding,
  dueThisWeek,
  dueThisMonth,
}: {
  totalOutstanding: number;
  dueThisWeek: number;
  dueThisMonth: number;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70 mb-4">
          Accounts Payable
        </p>
        <p className="text-2xl font-bold tabular-nums mb-3">{formatNzd(totalOutstanding)}</p>
        <div className="space-y-2">
          {dueThisWeek > 0 && (
            <div className="flex items-center justify-between rounded-md bg-rose-500/8 px-2.5 py-1.5">
              <span className="text-xs font-medium text-rose-500">Due this week</span>
              <span className="text-xs font-semibold tabular-nums text-rose-500">{formatNzd(dueThisWeek)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Due this month</span>
            <span className="text-sm font-medium tabular-nums">{formatNzd(dueThisMonth)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
