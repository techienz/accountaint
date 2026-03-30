import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

function formatNzd(value: number): string {
  return "$" + value.toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type CategoryData = {
  category: string;
  count: number;
  total: number;
  gstTotal: number;
};

export function CategoryBreakdown({
  data,
  grandTotal,
}: {
  data: CategoryData[];
  grandTotal: number;
}) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">By Category</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No expenses recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">By Category</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((item) => {
          const pct = grandTotal > 0 ? Math.round((item.total / grandTotal) * 100) : 0;
          return (
            <div key={item.category}>
              <div className="flex items-center justify-between text-sm">
                <span>{categoryLabels[item.category] || item.category}</span>
                <span className="font-medium">{formatNzd(item.total)}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        <div className="border-t pt-2 flex items-center justify-between font-medium text-sm">
          <span>Total</span>
          <span>{formatNzd(grandTotal)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
