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

type Benefit = {
  description: string;
  value: string;
  category: string;
};

export default function FbtPage() {
  const [quarter, setQuarter] = useState("1");
  const [benefits, setBenefits] = useState<Benefit[]>([
    { description: "", value: "", category: "other" },
  ]);
  const [result, setResult] = useState<{
    totalTaxableValue: number;
    fbtRate: number;
    fbtPayable: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  function addBenefit() {
    setBenefits([...benefits, { description: "", value: "", category: "other" }]);
  }

  function updateBenefit(index: number, field: keyof Benefit, value: string) {
    const updated = [...benefits];
    updated[index] = { ...updated[index], [field]: value };
    setBenefits(updated);
  }

  async function handleCalculate() {
    setSaving(true);
    const res = await fetch("/api/calculators/fbt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quarter: Number(quarter),
        benefits: benefits
          .filter((b) => b.description && Number(b.value) > 0)
          .map((b) => ({
            description: b.description,
            value: Number(b.value),
            category: b.category,
          })),
      }),
    });
    if (res.ok) setResult(await res.json());
    setSaving(false);
  }

  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">FBT Calculator</h1>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <Label>Quarter</Label>
            <Select value={quarter} onValueChange={(v) => v && setQuarter(v)}>
              <SelectTrigger><SelectValue labels={{ "1": "Q1 (Apr-Jun)", "2": "Q2 (Jul-Sep)", "3": "Q3 (Oct-Dec)", "4": "Q4 (Jan-Mar)" }} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Q1 (Apr-Jun)</SelectItem>
                <SelectItem value="2">Q2 (Jul-Sep)</SelectItem>
                <SelectItem value="3">Q3 (Oct-Dec)</SelectItem>
                <SelectItem value="4">Q4 (Jan-Mar)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <h3 className="font-medium">Benefits Provided</h3>
          {benefits.map((b, i) => (
            <div key={i} className="grid grid-cols-3 gap-3">
              <div>
                <Label>Description</Label>
                <Input
                  value={b.description}
                  onChange={(e) => updateBenefit(i, "description", e.target.value)}
                  placeholder="e.g. Company car"
                />
              </div>
              <div>
                <Label>Value ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={b.value}
                  onChange={(e) => updateBenefit(i, "value", e.target.value)}
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={b.category} onValueChange={(v) => v && updateBenefit(i, "category", v)}>
                  <SelectTrigger><SelectValue labels={{ vehicle: "Vehicle", low_interest_loan: "Low Interest Loan", other: "Other" }} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vehicle">Vehicle</SelectItem>
                    <SelectItem value="low_interest_loan">Low Interest Loan</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addBenefit}>
            + Add Benefit
          </Button>

          <Button onClick={handleCalculate} disabled={saving} className="w-full">
            {saving ? "Calculating..." : "Calculate FBT"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader><CardTitle>FBT Calculation</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Total Taxable Value</span>
              <span>{fmt(result.totalTaxableValue)}</span>
            </div>
            <div className="flex justify-between">
              <span>FBT Rate</span>
              <span>{(result.fbtRate * 100).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-lg font-bold">
              <span>FBT Payable</span>
              <span>{fmt(result.fbtPayable)}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
