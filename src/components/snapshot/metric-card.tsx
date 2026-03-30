import { Card, CardContent } from "@/components/ui/card";
import { Sparkline } from "./sparkline";

function formatNzd(value: number): string {
  return "$" + value.toLocaleString("en-NZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function MetricCard({
  title,
  value,
  previousValue,
  percentChange,
  sparklineData,
  sparklineColor,
  prefix = "$",
}: {
  title: string;
  value: number;
  previousValue?: number;
  percentChange?: number | null;
  sparklineData?: number[];
  sparklineColor?: string;
  prefix?: string;
}) {
  const formatted = prefix === "$" ? formatNzd(value) : `${value}%`;
  const isPositive = percentChange != null && percentChange >= 0;

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
              {title}
            </p>
            <p className="text-3xl font-bold tracking-tight">{formatted}</p>
            {percentChange != null && (
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isPositive
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-rose-500/10 text-rose-500"
                  }`}
                >
                  {isPositive ? "\u2191" : "\u2193"} {Math.abs(percentChange)}%
                </span>
                <span className="text-xs text-muted-foreground/50">vs last month</span>
              </div>
            )}
            {previousValue !== undefined && percentChange == null && (
              <p className="text-xs text-muted-foreground/60">
                Last month: {prefix === "$" ? formatNzd(previousValue) : `${previousValue}%`}
              </p>
            )}
          </div>
          {sparklineData && sparklineData.length >= 2 && (
            <div className="pt-1">
              <Sparkline data={sparklineData} color={sparklineColor || "oklch(0.55 0.14 175)"} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
