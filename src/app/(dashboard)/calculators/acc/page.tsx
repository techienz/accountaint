"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AccPage() {
  const [cuCode, setCuCode] = useState("");
  const [cuDescription, setCuDescription] = useState("");
  const [liableEarnings, setLiableEarnings] = useState("");
  const [levyRate, setLevyRate] = useState("");
  const [actualLevy, setActualLevy] = useState("");
  const [result, setResult] = useState<{
    estimatedLevy: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/calculators/acc")
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          setCuCode(data.cu_code || "");
          setCuDescription(data.cu_description || "");
          setLiableEarnings(String(data.liable_earnings || ""));
          setLevyRate(String(data.levy_rate || ""));
          setActualLevy(String(data.actual_levy || ""));
          setResult({ estimatedLevy: data.estimated_levy });
        }
      });
  }, []);

  async function handleCalculate() {
    setSaving(true);
    const res = await fetch("/api/calculators/acc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cu_code: cuCode || null,
        cu_description: cuDescription || null,
        liable_earnings: Number(liableEarnings) || 0,
        levy_rate: Number(levyRate) || 0,
        actual_levy: Number(actualLevy) || null,
      }),
    });
    if (res.ok) setResult(await res.json());
    setSaving(false);
  }

  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">ACC Levy Review</h1>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>CU Code</Label>
              <Input value={cuCode} onChange={(e) => setCuCode(e.target.value)} placeholder="e.g. 72610" />
            </div>
            <div>
              <Label>CU Description</Label>
              <Input value={cuDescription} onChange={(e) => setCuDescription(e.target.value)} placeholder="e.g. Computer Services" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Liable Earnings ($)</Label>
              <Input type="number" step="0.01" value={liableEarnings} onChange={(e) => setLiableEarnings(e.target.value)} />
            </div>
            <div>
              <Label>Levy Rate (per $100)</Label>
              <Input type="number" step="0.01" value={levyRate} onChange={(e) => setLevyRate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Actual Levy Invoiced ($)</Label>
            <Input type="number" step="0.01" value={actualLevy} onChange={(e) => setActualLevy(e.target.value)} placeholder="From ACC invoice" />
          </div>

          <Button onClick={handleCalculate} disabled={saving}>
            {saving ? "Calculating..." : "Calculate / Save"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader><CardTitle>Estimated Levy</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between text-lg font-bold">
              <span>Estimated Annual Levy</span>
              <span>{fmt(result.estimatedLevy)}</span>
            </div>
            {actualLevy && Number(actualLevy) > 0 && (
              <div className="flex justify-between">
                <span>Actual vs Estimated</span>
                <span className={Number(actualLevy) > result.estimatedLevy ? "text-red-600" : "text-green-600"}>
                  {Number(actualLevy) > result.estimatedLevy ? "+" : ""}
                  {fmt(Number(actualLevy) - result.estimatedLevy)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
