import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CrosscheckCard({
  newAnomalyCount,
  recentChangeCount,
}: {
  newAnomalyCount: number;
  recentChangeCount: number;
}) {
  if (recentChangeCount === 0 && newAnomalyCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Accountant Cross-check</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No recent changes detected in your Xero data.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Accountant Cross-check</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {recentChangeCount > 0 && (
            <p className="text-sm">
              <span className="font-medium">{recentChangeCount}</span>{" "}
              {recentChangeCount === 1 ? "change" : "changes"} detected recently
            </p>
          )}
          {newAnomalyCount > 0 && (
            <p className="text-sm">
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                {newAnomalyCount} {newAnomalyCount === 1 ? "item" : "items"} flagged
              </span>
            </p>
          )}
          <Link
            href="/crosscheck"
            className="inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            Review changes
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
