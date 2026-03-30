"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, ArrowRight } from "lucide-react";

type Asset = {
  id: string;
  name: string;
  category: string;
  purchase_date: string;
  cost: number;
  depreciation_method: string;
  depreciation_rate: number;
  is_low_value: boolean;
  disposed: boolean;
  currentBookValue: number;
};

type DepRunResult = {
  assetsProcessed: number;
  totalDepreciation: number;
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [running, setRunning] = useState(false);
  const [depResult, setDepResult] = useState<DepRunResult | null>(null);

  function loadAssets() {
    fetch("/api/assets").then((r) => r.json()).then(setAssets);
  }

  useEffect(() => { loadAssets(); }, []);

  async function runDepreciation() {
    setRunning(true);
    const res = await fetch("/api/assets/depreciation/run", { method: "POST" });
    if (res.ok) {
      const result = await res.json();
      setDepResult(result);
      loadAssets();
    }
    setRunning(false);
  }

  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  const totalCost = assets.reduce((s, a) => s + a.cost, 0);
  const totalBookValue = assets.filter((a) => !a.disposed).reduce((s, a) => s + a.currentBookValue, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Asset Register</h1>
          <p className="text-muted-foreground">
            {assets.length} assets · Total cost: {fmt(totalCost)} · Book value: {fmt(totalBookValue)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={runDepreciation} disabled={running}>
            {running ? "Running..." : "Run Depreciation"}
          </Button>
          <Link href="/assets/new">
            <Button><Plus className="mr-2 h-4 w-4" />Add Asset</Button>
          </Link>
        </div>
      </div>

      {depResult && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm">
              Processed {depResult.assetsProcessed} assets.
              Total depreciation: <span className="font-bold">{fmt(depResult.totalDepreciation)}</span>
            </p>
          </CardContent>
        </Card>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead>Method</TableHead>
            <TableHead className="text-right">Rate</TableHead>
            <TableHead className="text-right">Book Value</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((a) => (
            <TableRow key={a.id} className="group cursor-pointer hover:bg-accent/50" onClick={() => window.location.href = `/assets/${a.id}`}>
              <TableCell>
                <Link href={`/assets/${a.id}`} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                  {a.name}
                </Link>
              </TableCell>
              <TableCell>{a.category}</TableCell>
              <TableCell>{a.purchase_date}</TableCell>
              <TableCell className="text-right">{fmt(a.cost)}</TableCell>
              <TableCell>{a.depreciation_method}</TableCell>
              <TableCell className="text-right">{(a.depreciation_rate * 100).toFixed(1)}%</TableCell>
              <TableCell className="text-right">{fmt(a.currentBookValue)}</TableCell>
              <TableCell>
                {a.disposed ? (
                  <Badge variant="secondary">Disposed</Badge>
                ) : a.is_low_value ? (
                  <Badge variant="outline">Low Value</Badge>
                ) : (
                  <Badge>Active</Badge>
                )}
              </TableCell>
              <TableCell>
                <span className="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground flex items-center gap-1 transition-opacity">
                  View <ArrowRight className="h-3 w-3" />
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
