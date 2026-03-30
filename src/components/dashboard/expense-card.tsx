import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatNzd(value: number): string {
  return value.toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const categoryLabels: Record<string, string> = {
  office_supplies: "Office Supplies",
  travel: "Travel",
  meals_entertainment: "Meals & Entertainment",
  professional_fees: "Professional Fees",
  software_subscriptions: "Software/Subscriptions",
  vehicle: "Vehicle",
  home_office: "Home Office",
  utilities: "Utilities",
  insurance: "Insurance",
  bank_fees: "Bank Fees",
  other: "Other",
};

export function ExpenseCard({
  monthTotal,
  topCategory,
}: {
  monthTotal: number;
  topCategory: { category: string; total: number } | null;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Expenses</CardTitle>
        <Link
          href="/expenses"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">This month</span>
          <span className="font-medium">${formatNzd(monthTotal)}</span>
        </div>
        {topCategory && topCategory.total > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Top: {categoryLabels[topCategory.category] || topCategory.category}
            </span>
            <span className="text-sm">${formatNzd(topCategory.total)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
