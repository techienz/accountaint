"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function VehiclePage() {
  const [method, setMethod] = useState<"mileage_rate" | "actual_cost">("mileage_rate");
  const [totalKm, setTotalKm] = useState("");
  const [businessPct, setBusinessPct] = useState("");
  const [actualCosts, setActualCosts] = useState({
    fuel: "", insurance: "", rego: "", maintenance: "", depreciation: "",
  });
  const [result, setResult] = useState<{
    totalClaim: number;
    breakdown: { item: string; amount: number }[];
  } | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCalculate() {
    setSaving(true);
    const res = await fetch("/api/calculators/vehicle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method,
        total_business_km: Number(totalKm) || 0,
        business_use_percentage: Number(businessPct) || 0,
        actual_costs: method === "actual_cost" ? {
          fuel: Number(actualCosts.fuel) || 0,
          insurance: Number(actualCosts.insurance) || 0,
          rego: Number(actualCosts.rego) || 0,
          maintenance: Number(actualCosts.maintenance) || 0,
          depreciation: Number(actualCosts.depreciation) || 0,
        } : null,
      }),
    });
    if (res.ok) setResult(await res.json());
    setSaving(false);
  }

  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Motor Vehicle Calculator</h1>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <Label>Claim Method</Label>
            <Select value={method} onValueChange={(v) => v && setMethod(v as "mileage_rate" | "actual_cost")}>
              <SelectTrigger><SelectValue labels={{ mileage_rate: "Mileage Rate ($0.99/km)", actual_cost: "Actual Costs" }} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mileage_rate">Mileage Rate ($0.99/km)</SelectItem>
                <SelectItem value="actual_cost">Actual Costs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {method === "mileage_rate" ? (
            <div>
              <Label>Total Business Kilometres</Label>
              <Input type="number" value={totalKm} onChange={(e) => setTotalKm(e.target.value)} />
            </div>
          ) : (
            <>
              <div>
                <Label>Business Use Percentage (%)</Label>
                <Input type="number" min="0" max="100" value={businessPct} onChange={(e) => setBusinessPct(e.target.value)} />
              </div>
              <h3 className="font-medium">Annual Costs</h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(actualCosts).map(([key, val]) => (
                  <div key={key}>
                    <Label className="capitalize">{key}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={val}
                      onChange={(e) => setActualCosts({ ...actualCosts, [key]: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          <Button onClick={handleCalculate} disabled={saving}>
            {saving ? "Calculating..." : "Calculate Claim"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader><CardTitle>Result</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {result.breakdown.map((b, i) => (
              <div key={i} className="flex justify-between">
                <span>{b.item}</span>
                <span>{fmt(b.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 text-lg font-bold">
              <span>Total Claim</span>
              <span>{fmt(result.totalClaim)}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
