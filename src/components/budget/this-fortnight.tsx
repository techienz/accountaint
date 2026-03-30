"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatPeriodDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

type FortnightItem = {
  name: string;
  monthly_amount: number;
  due_day: number | null;
};

export function ThisFortnight({
  items,
  periodStart,
  periodEnd,
}: {
  items: FortnightItem[];
  periodStart: string;
  periodEnd: string;
}) {
  const total = items.reduce((s, i) => s + i.monthly_amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          This Fortnight
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {formatPeriodDate(periodStart)} — {formatPeriodDate(periodEnd)}
        </p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bills due this fortnight</p>
        ) : (
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div>
                  <span>{item.name}</span>
                  {item.due_day && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (day {item.due_day})
                    </span>
                  )}
                </div>
                <span className="font-medium">{fmt(item.monthly_amount)}</span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between text-sm font-medium">
              <span>Total due</span>
              <span>{fmt(total)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
