"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { todayNZ } from "@/lib/utils/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DepRecord = {
  tax_year: string;
  opening_book_value: number;
  depreciation_amount: number;
  closing_book_value: number;
  depreciation_recovered: number | null;
  loss_on_sale: number | null;
};

type AssetDetail = {
  id: string;
  name: string;
  category: string;
  purchase_date: string;
  cost: number;
  depreciation_method: string;
  depreciation_rate: number;
  is_low_value: boolean;
  disposed: boolean;
  disposal_date: string | null;
  disposal_price: number | null;
  notes: string | null;
  receipt_path: string | null;
  receipt_mime: string | null;
  depreciationHistory: DepRecord[];
};

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [showDispose, setShowDispose] = useState(false);
  const [salePrice, setSalePrice] = useState("");
  const [disposalDate, setDisposalDate] = useState(todayNZ());

  useEffect(() => {
    fetch(`/api/assets/${params.id}`)
      .then((r) => r.json())
      .then(setAsset);
  }, [params.id]);

  async function handleDispose() {
    const res = await fetch(`/api/assets/${params.id}/dispose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sale_price: Number(salePrice),
        disposal_date: disposalDate,
      }),
    });

    if (res.ok) {
      const result = await res.json();
      if (result.depreciationRecovered > 0) {
        alert(`Depreciation recovered: $${result.depreciationRecovered.toFixed(2)} (taxable income)`);
      } else if (result.lossOnSale > 0) {
        alert(`Loss on sale: $${result.lossOnSale.toFixed(2)} (deductible)`);
      }
      router.push("/assets");
    }
  }

  if (!asset) return <div>Loading...</div>;

  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{asset.name}</h1>
          <p className="text-muted-foreground">
            {asset.category} · {asset.depreciation_method} @{" "}
            {(asset.depreciation_rate * 100).toFixed(1)}%
          </p>
        </div>
        {asset.disposed ? (
          <Badge variant="secondary">Disposed</Badge>
        ) : asset.is_low_value ? (
          <Badge variant="outline">Low Value — Fully Expensed</Badge>
        ) : (
          <Button
            variant="outline"
            onClick={() => setShowDispose(!showDispose)}
          >
            Dispose Asset
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Purchase Date</CardTitle>
          </CardHeader>
          <CardContent className="font-medium">
            {asset.purchase_date}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cost (ex GST)</CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{fmt(asset.cost)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Current Book Value</CardTitle>
          </CardHeader>
          <CardContent className="font-medium">
            {asset.depreciationHistory.length > 0
              ? fmt(asset.depreciationHistory[0].closing_book_value)
              : fmt(asset.cost)}
          </CardContent>
        </Card>
      </div>

      {showDispose && (
        <Card>
          <CardHeader>
            <CardTitle>Dispose Asset</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sale Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                />
              </div>
              <div>
                <Label>Disposal Date</Label>
                <Input
                  type="date"
                  value={disposalDate}
                  onChange={(e) => setDisposalDate(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleDispose}>Confirm Disposal</Button>
          </CardContent>
        </Card>
      )}

      {asset.receipt_path && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receipt / Proof of Purchase</CardTitle>
          </CardHeader>
          <CardContent>
            {asset.receipt_mime?.startsWith("image/") ? (
              <img
                src={`/api/assets/${asset.id}/receipt`}
                alt="Receipt"
                className="max-w-md rounded border"
              />
            ) : (
              <a
                href={`/api/assets/${asset.id}/receipt`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                View receipt (PDF)
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {asset.depreciationHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Depreciation History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tax Year</TableHead>
                  <TableHead className="text-right">Opening BV</TableHead>
                  <TableHead className="text-right">Depreciation</TableHead>
                  <TableHead className="text-right">Closing BV</TableHead>
                  <TableHead className="text-right">Recovery/Loss</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asset.depreciationHistory.map((d) => (
                  <TableRow key={d.tax_year}>
                    <TableCell>{d.tax_year}</TableCell>
                    <TableCell className="text-right">
                      {fmt(d.opening_book_value)}
                    </TableCell>
                    <TableCell className="text-right">
                      {fmt(d.depreciation_amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {fmt(d.closing_book_value)}
                    </TableCell>
                    <TableCell className="text-right">
                      {d.depreciation_recovered
                        ? `+${fmt(d.depreciation_recovered)}`
                        : d.loss_on_sale
                          ? `-${fmt(d.loss_on_sale)}`
                          : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
