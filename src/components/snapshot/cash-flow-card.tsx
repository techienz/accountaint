import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

function formatNzd(value: number): string {
  return "$" + value.toLocaleString("en-NZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function CashFlowCard({
  cashIn,
  cashOut,
  net,
}: {
  cashIn: number;
  cashOut: number;
  net: number;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70 mb-4">
          Cash Flow — This Month
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />
              Cash in
            </span>
            <span className="font-semibold tabular-nums text-emerald-500">{formatNzd(cashIn)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowUpRight className="h-3.5 w-3.5 text-rose-500" />
              Cash out
            </span>
            <span className="font-semibold tabular-nums text-rose-500">{formatNzd(cashOut)}</span>
          </div>
          <div className="border-t pt-3 flex items-center justify-between">
            <span className="text-sm font-medium">Net</span>
            <span className={`text-lg font-bold tabular-nums ${net >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {net >= 0 ? "+" : ""}{formatNzd(net)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
