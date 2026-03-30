"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type CategoryData = {
  id: string;
  name: string;
  color: string | null;
  monthlyTotal: number;
  fortnightlyTotal: number;
  itemCount: number;
};

export function CategoryBreakdown({
  categories,
  isFortnightly,
}: {
  categories: CategoryData[];
  isFortnightly: boolean;
}) {
  const total = categories.reduce(
    (s, c) => s + (isFortnightly ? c.fortnightlyTotal : c.monthlyTotal),
    0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Where Your Money Goes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {categories.map((cat) => {
          const amount = isFortnightly ? cat.fortnightlyTotal : cat.monthlyTotal;
          const pct = total > 0 ? (amount / total) * 100 : 0;
          return (
            <div key={cat.id}>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: cat.color ?? "#6b7280" }}
                  />
                  <span>{cat.name}</span>
                  <span className="text-muted-foreground">({cat.itemCount})</span>
                </div>
                <span className="font-medium">{fmt(amount)}</span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    backgroundColor: cat.color ?? "#6b7280",
                  }}
                />
              </div>
            </div>
          );
        })}
        <div className="border-t pt-3 flex justify-between text-sm font-medium">
          <span>Total</span>
          <span>{fmt(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
