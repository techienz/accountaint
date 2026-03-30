import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatNzd(value: number): string {
  return value.toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ContractsCard({
  monthlyTotal,
  expiringCount,
  totalContracts,
}: {
  monthlyTotal: number;
  expiringCount: number;
  totalContracts: number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Contracts</CardTitle>
        <Link
          href="/contracts"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Monthly cost</span>
          <span className="font-medium">${formatNzd(monthlyTotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Active contracts</span>
          <span className="font-medium">{totalContracts}</span>
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
