import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Props = {
  totalToSetAside: number;
  totalActualSetAside: number;
  shortfallOrSurplus: number;
  gstOwed: number;
  gstSource?: "xero" | "invoices" | "contracts" | "none";
  estimatedIncomeTax: number;
  estimatedProfit?: number;
  incomeSource?: "xero" | "contracts" | "none";
};

const SOURCE_LABELS: Record<string, string> = {
  xero: "from Xero",
  contracts: "estimated from work contracts",
  invoices: "from local invoices",
  none: "no data",
};

export function SavingsSummary({
  totalToSetAside,
  totalActualSetAside,
  shortfallOrSurplus,
  gstOwed,
  gstSource,
  estimatedIncomeTax,
  estimatedProfit,
  incomeSource,
}: Props) {
  const fmt = (n: number) =>
    "$" + Math.abs(n).toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  const status =
    shortfallOrSurplus >= 0
      ? "surplus"
      : shortfallOrSurplus > -1000
        ? "close"
        : "short";

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Total to Set Aside
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{fmt(totalToSetAside)}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            GST: {fmt(gstOwed)}{gstSource ? ` (${SOURCE_LABELS[gstSource]})` : ""}
          </div>
          <div className="text-xs text-muted-foreground">
            Income Tax: {fmt(estimatedIncomeTax)}
            {incomeSource && estimatedProfit != null && estimatedProfit > 0
              ? ` on ${fmt(estimatedProfit)} profit (${SOURCE_LABELS[incomeSource]})`
              : incomeSource ? ` (${SOURCE_LABELS[incomeSource]})` : ""}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Actually Set Aside
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{fmt(totalActualSetAside)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {shortfallOrSurplus >= 0 ? "Surplus" : "Shortfall"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span
              className={`text-2xl font-bold ${
                status === "surplus"
                  ? "text-green-600"
                  : status === "close"
                    ? "text-amber-600"
                    : "text-red-600"
              }`}
            >
              {fmt(shortfallOrSurplus)}
            </span>
            <Badge
              variant={
                status === "surplus"
                  ? "default"
                  : status === "close"
                    ? "secondary"
                    : "destructive"
              }
            >
              {status === "surplus"
                ? "On track"
                : status === "close"
                  ? "Slightly under"
                  : "Behind"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
