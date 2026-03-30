import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatNzd(value: number): string {
  return value.toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function BudgetCard({
  fortnightlyIncome,
  fortnightlyExpenses,
  fortnightlyRemaining,
  billsDueCount,
}: {
  fortnightlyIncome: number;
  fortnightlyExpenses: number;
  fortnightlyRemaining: number;
  billsDueCount: number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Personal Budget</CardTitle>
        <Link
          href="/budget"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Fortnightly income</span>
          <span className="font-medium text-green-600">${formatNzd(fortnightlyIncome)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Fortnightly expenses</span>
          <span className="font-medium">${formatNzd(fortnightlyExpenses)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Remaining</span>
          <span className={`font-medium ${fortnightlyRemaining >= 0 ? "text-green-600" : "text-red-600"}`}>
            ${formatNzd(fortnightlyRemaining)}
          </span>
        </div>
        {billsDueCount > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground">
              {billsDueCount} {billsDueCount === 1 ? "bill" : "bills"} due this fortnight
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
