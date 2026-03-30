"use client";

import { useEffect, useState } from "react";
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

type CostFields = {
  rates: string;
  insurance: string;
  mortgage_interest: string;
  rent: string;
  power: string;
  internet: string;
};

export default function HomeOfficePage() {
  const [method, setMethod] = useState<"proportional" | "sqm_rate">("proportional");
  const [officeArea, setOfficeArea] = useState("");
  const [totalArea, setTotalArea] = useState("");
  const [costs, setCosts] = useState<CostFields>({
    rates: "", insurance: "", mortgage_interest: "",
    rent: "", power: "", internet: "",
  });
  const [result, setResult] = useState<{
    proportion: number;
    totalCosts: number;
    totalClaim: number;
    breakdown: { item: string; cost: number; claim: number }[];
  } | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCalculate() {
    setSaving(true);
    const res = await fetch("/api/calculators/home-office", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method,
        office_area_sqm: Number(officeArea),
        total_area_sqm: Number(totalArea),
        costs: {
          rates: Number(costs.rates) || 0,
          insurance: Number(costs.insurance) || 0,
          mortgage_interest: Number(costs.mortgage_interest) || 0,
          rent: Number(costs.rent) || 0,
          power: Number(costs.power) || 0,
          internet: Number(costs.internet) || 0,
        },
      }),
    });
    if (res.ok) setResult(await res.json());
    setSaving(false);
  }

  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Home Office Calculator</h1>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <Label>Method</Label>
            <Select value={method} onValueChange={(v) => v && setMethod(v as "proportional" | "sqm_rate")}>
              <SelectTrigger><SelectValue labels={{ proportional: "Proportional (floor area)", sqm_rate: "Square metre rate" }} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="proportional">Proportional (floor area)</SelectItem>
                <SelectItem value="sqm_rate">Square metre rate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Office Area (sqm)</Label>
              <Input type="number" step="0.1" value={officeArea} onChange={(e) => setOfficeArea(e.target.value)} />
            </div>
            <div>
              <Label>Total Home Area (sqm)</Label>
              <Input type="number" step="0.1" value={totalArea} onChange={(e) => setTotalArea(e.target.value)} />
            </div>
          </div>

          <h3 className="font-medium">Annual Costs</h3>
          <div className="grid grid-cols-2 gap-4">
            {(Object.keys(costs) as (keyof CostFields)[]).map((key) => (
              <div key={key}>
                <Label className="capitalize">{key.replace("_", " ")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={costs[key]}
                  onChange={(e) => setCosts({ ...costs, [key]: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            ))}
          </div>

          <Button onClick={handleCalculate} disabled={saving}>
            {saving ? "Calculating..." : "Calculate Claim"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Calculation Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Office proportion</span>
              <span>{(result.proportion * 100).toFixed(1)}%</span>
            </div>
            {result.breakdown.map((b, i) => (
              <div key={i} className="flex justify-between">
                <span>{b.item}</span>
                <span>{fmt(b.cost)} → {fmt(b.claim)}</span>
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
