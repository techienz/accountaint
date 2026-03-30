import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PiggyBank } from "lucide-react";

type Props = {
  monthlyTarget: number;
  shortfallOrSurplus: number;
};

export function TaxSavingsCard({ monthlyTarget, shortfallOrSurplus }: Props) {
  const fmt = (n: number) =>
    "$" + Math.abs(n).toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  const status =
    shortfallOrSurplus >= 0
      ? "green"
      : shortfallOrSurplus > -1000
        ? "amber"
        : "red";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Tax Savings</CardTitle>
        <PiggyBank className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{fmt(monthlyTarget)}/mo</div>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              status === "green"
                ? "bg-green-500"
                : status === "amber"
                  ? "bg-amber-500"
                  : "bg-red-500"
            }`}
          />
          <span className="text-xs text-muted-foreground">
            {shortfallOrSurplus >= 0
              ? `${fmt(shortfallOrSurplus)} ahead`
              : `${fmt(shortfallOrSurplus)} behind`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
