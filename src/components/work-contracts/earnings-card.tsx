import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatNzd(value: number): string {
  return "$" + value.toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function EarningsCard({
  grossProjected,
  wtAmount,
  netProjected,
  wtRate,
}: {
  grossProjected: number;
  wtAmount: number;
  netProjected: number;
  wtRate: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Earnings Projection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Gross projected</span>
          <span className="font-medium">{formatNzd(grossProjected)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            WT deduction ({Math.round(wtRate * 100)}%)
          </span>
          <span className="font-medium text-destructive">-{formatNzd(wtAmount)}</span>
        </div>
        <div className="border-t pt-3 flex items-center justify-between">
          <span className="text-sm font-medium">Net projected</span>
          <span className="text-lg font-bold">{formatNzd(netProjected)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
