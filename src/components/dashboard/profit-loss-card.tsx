import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import { extractTotals } from "@/lib/reports/parsers";

type ProfitLossData = {
  Reports?: Array<{
    Rows?: Array<{
      RowType: string;
      Title?: string;
      Rows?: Array<{
        RowType: string;
        Cells?: Array<{ Value: string }>;
      }>;
    }>;
  }>;
};

export function ProfitLossCard({
  data,
  connected,
}: {
  data: ProfitLossData | null;
  connected: boolean;
}) {
  if (!connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Profit & Loss</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            <Link href="/settings/xero" className="text-primary hover:underline">
              Connect Xero
            </Link>{" "}
            to see your profit and loss.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totals = extractTotals(data);

  if (!totals) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Profit & Loss</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No data yet. Try syncing from Xero.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isProfit = totals.netProfit >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Profit & Loss</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Revenue</span>
          <span className="font-medium">
            ${totals.revenue.toLocaleString("en-NZ", { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Expenses</span>
          <span className="font-medium">
            ${totals.expenses.toLocaleString("en-NZ", { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="border-t pt-3 flex items-center justify-between">
          <span className="text-sm font-medium">Net Profit</span>
          <span
            className={`flex items-center gap-1 font-semibold ${
              isProfit ? "text-green-600" : "text-red-600"
            }`}
          >
            {isProfit ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            ${Math.abs(totals.netProfit).toLocaleString("en-NZ", {
              minimumFractionDigits: 2,
            })}
          </span>
        </div>
        <div className="border-t pt-3">
          <Link
            href="/reports/profit-loss"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            View report →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
