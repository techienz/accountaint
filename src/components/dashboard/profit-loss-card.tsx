import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";

type ProfitLossProps = {
  revenue: number;
  expenses: number;
  netProfit: number;
  hasData: boolean;
};

export function ProfitLossCard({ revenue, expenses, netProfit, hasData }: ProfitLossProps) {
  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Profit & Loss</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No financial data yet. Start by creating invoices or recording expenses.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isProfit = netProfit >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Profit & Loss</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Revenue</span>
          <span className="font-medium">
            ${revenue.toLocaleString("en-NZ", { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Expenses</span>
          <span className="font-medium">
            ${expenses.toLocaleString("en-NZ", { minimumFractionDigits: 2 })}
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
            ${Math.abs(netProfit).toLocaleString("en-NZ", {
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
