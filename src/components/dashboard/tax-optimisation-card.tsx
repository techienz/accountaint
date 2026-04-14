"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown } from "lucide-react";

const fmt = (n: number) =>
  "$" + Math.abs(n).toLocaleString("en-NZ", { minimumFractionDigits: 0 });

export function TaxOptimisationCard() {
  const [data, setData] = useState<{
    totalPotentialSaving: number;
    opportunityCount: number;
    lastScanned: string | null;
  } | null>(null);

  useEffect(() => {
    fetch("/api/tax-optimisation")
      .then((r) => r.json())
      .then((res) => {
        if (res.result) {
          setData({
            totalPotentialSaving: res.result.total_potential_saving,
            opportunityCount: res.result.opportunity_count,
            lastScanned: res.result.scanned_at,
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <Link href="/tax-optimisation">
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Tax Optimisation</CardTitle>
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {data && data.opportunityCount > 0 ? (
            <div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {fmt(data.totalPotentialSaving)}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.opportunityCount} opportunit{data.opportunityCount === 1 ? "y" : "ies"} found
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground">
                {data ? "No opportunities found" : "Not yet scanned"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Click to run analysis
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
