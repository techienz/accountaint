import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

type Props = {
  totalAssets: number;
  totalCost: number;
  totalBookValue: number;
  totalDepreciation: number;
};

export function DepreciationSummary({
  totalAssets,
  totalCost,
  totalBookValue,
  totalDepreciation,
}: Props) {
  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Asset Summary</CardTitle>
        <Package className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-muted-foreground">Assets</div>
            <div className="font-medium">{totalAssets}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Total Cost</div>
            <div className="font-medium">{fmt(totalCost)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Book Value</div>
            <div className="font-medium">{fmt(totalBookValue)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">YTD Depreciation</div>
            <div className="font-medium">{fmt(totalDepreciation)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
