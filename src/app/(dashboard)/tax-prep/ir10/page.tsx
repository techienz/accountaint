"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type IR10IbData = {
  taxYear: string;
  ibTotalAssetCost: number;
  ibTotalDeduction: number;
  ibAssetCount: number;
  ibAssets: {
    id: string;
    name: string;
    cost: number;
    purchase_date: string;
    ib_amount: number;
  }[];
};

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

export default function IR10PrepPage() {
  const [data, setData] = useState<IR10IbData | null>(null);

  useEffect(() => {
    fetch("/api/tax-prep/ir10")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <div>Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">IR10 Prep — Investment Boost</h1>
        <p className="text-muted-foreground">
          Tax year {data.taxYear} · {data.ibAssetCount} asset
          {data.ibAssetCount === 1 ? "" : "s"} eligible
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            New IR10 line (2026 tax year onwards)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            "Total value of assets for which Investment Boost is being claimed"
            — IRD requires the GROSS asset cost on this line, not the
            deduction amount.
          </p>
          <p className="text-3xl font-semibold text-emerald-600">
            {fmt(data.ibTotalAssetCost)}
          </p>
          <p className="text-sm text-muted-foreground">
            Resulting Investment Boost deduction (claimed via the normal P&L
            expense line): <span className="font-medium">{fmt(data.ibTotalDeduction)}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Source:{" "}
            <a
              href="https://www.ird.govt.nz/investment-boost"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              ird.govt.nz/investment-boost
            </a>
          </p>
        </CardContent>
      </Card>

      {data.ibAssetCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Assets included</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Purchase date</TableHead>
                  <TableHead className="text-right">Cost (ex GST)</TableHead>
                  <TableHead className="text-right">IB deduction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.ibAssets.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{a.purchase_date}</TableCell>
                    <TableCell className="text-right">{fmt(a.cost)}</TableCell>
                    <TableCell className="text-right text-emerald-600">
                      {fmt(a.ib_amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {data.ibAssetCount === 0 && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No assets are currently classified as eligible for Investment
            Boost in tax year {data.taxYear}. Add an asset and mark it as new
            (or new-to-NZ) to start claiming.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
