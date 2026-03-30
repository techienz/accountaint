import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatNzd(value: number): string {
  return value.toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function WorkContractsCard({
  activeContracts,
  totalWeeklyHours,
  totalProjectedEarnings,
  expiringCount,
}: {
  activeContracts: number;
  totalWeeklyHours: number;
  totalProjectedEarnings: number;
  expiringCount: number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Work Contracts</CardTitle>
        <Link
          href="/work-contracts"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Active contracts</span>
          <span className="font-medium">{activeContracts}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Weekly hours</span>
          <span className="font-medium">{totalWeeklyHours}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Projected earnings</span>
          <span className="font-medium">${formatNzd(totalProjectedEarnings)}</span>
        </div>
        {expiringCount > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs text-amber-600">
              {expiringCount} {expiringCount === 1 ? "contract" : "contracts"} expiring soon
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
