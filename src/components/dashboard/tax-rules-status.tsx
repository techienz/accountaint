import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale } from "lucide-react";
import type { RulesFreshness } from "@/lib/tax/rules";

type TaxRulesStatusProps = {
  taxYear: number;
  rulesVersion: string | null;
  lastVerified: string | null;
  freshness: RulesFreshness;
  daysSinceVerified: number | null;
  pendingUpdates?: number;
};

const freshnessConfig: Record<
  RulesFreshness,
  { label: string; dotClass: string; textClass: string }
> = {
  fresh: {
    label: "Verified",
    dotClass: "bg-green-500",
    textClass: "text-green-600",
  },
  aging: {
    label: "Review needed",
    dotClass: "bg-amber-500",
    textClass: "text-amber-600",
  },
  stale: {
    label: "Out of date",
    dotClass: "bg-red-500",
    textClass: "text-red-600",
  },
};

export function TaxRulesStatus({
  taxYear,
  rulesVersion,
  lastVerified,
  freshness,
  daysSinceVerified,
  pendingUpdates = 0,
}: TaxRulesStatusProps) {
  const config = freshnessConfig[freshness];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Tax Rules</CardTitle>
        <Scale className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{taxYear}</span>
            {rulesVersion && (
              <span className="text-sm text-muted-foreground">
                v{rulesVersion}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${config.dotClass}`} />
            <span className={`font-medium ${config.textClass}`}>
              {config.label}
            </span>
            {daysSinceVerified !== null && (
              <span className="text-muted-foreground">
                ·{" "}
                {daysSinceVerified === 0
                  ? "today"
                  : `${daysSinceVerified}d ago`}
              </span>
            )}
          </div>

          {pendingUpdates > 0 && (
            <Link
              href="/settings/regulatory-updates"
              className="text-xs text-amber-600 hover:underline"
            >
              {pendingUpdates} update{pendingUpdates > 1 ? "s" : ""} available &rarr;
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
