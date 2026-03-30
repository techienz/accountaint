"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

type Scenario = {
  salary: number;
  dividend: number;
  companyTax: number;
  personalTax: number;
  totalTax: number;
  effectiveRate: number;
};

type OptimiserResult = {
  optimal: Scenario;
  scenarios: Scenario[];
};

type Props = {
  shareholderId: string;
};

export function OptimiserPanel({ shareholderId }: Props) {
  const [companyProfit, setCompanyProfit] = useState(100000);
  const [otherIncome, setOtherIncome] = useState(0);
  const [salary, setSalary] = useState(0);
  const [result, setResult] = useState<OptimiserResult | null>(null);

  useEffect(() => {
    // Client-side calculation via API
    const params = new URLSearchParams({
      company_profit: String(companyProfit),
      other_income: String(otherIncome),
    });

    fetch(`/api/shareholders/${shareholderId}/optimise?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setResult(data);
        setSalary(data.optimal.salary);
      });
  }, [shareholderId, companyProfit, otherIncome]);

  if (!result) return <div>Loading...</div>;

  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  const currentScenario =
    result.scenarios.find((s) => s.salary === salary) || result.optimal;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Company Profit ($)</Label>
          <Input
            type="number"
            value={companyProfit}
            onChange={(e) => setCompanyProfit(Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Other Personal Income ($)</Label>
          <Input
            type="number"
            value={otherIncome}
            onChange={(e) => setOtherIncome(Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <Label>
          Salary: {fmt(salary)} / Remaining as dividend: {fmt(currentScenario.dividend)}
        </Label>
        <Slider
          value={[salary]}
          min={0}
          max={companyProfit}
          step={5000}
          onValueChange={(value) => setSalary(Array.isArray(value) ? value[0] : value)}
          className="mt-2"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Current Split
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Company Tax</span>
              <span>{fmt(currentScenario.companyTax)}</span>
            </div>
            <div className="flex justify-between">
              <span>Personal Tax</span>
              <span>{fmt(currentScenario.personalTax)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-bold">
              <span>Total Tax</span>
              <span>{fmt(currentScenario.totalTax)}</span>
            </div>
            <div className="text-muted-foreground">
              Effective rate: {(currentScenario.effectiveRate * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Optimal Split
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Salary</span>
              <span>{fmt(result.optimal.salary)}</span>
            </div>
            <div className="flex justify-between">
              <span>Dividend</span>
              <span>{fmt(result.optimal.dividend)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-bold">
              <span>Total Tax</span>
              <span>{fmt(result.optimal.totalTax)}</span>
            </div>
            <div className="text-muted-foreground">
              Effective rate:{" "}
              {(result.optimal.effectiveRate * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {currentScenario.totalTax > result.optimal.totalTax && (
        <p className="text-sm text-muted-foreground">
          Switching to the optimal split would save{" "}
          <span className="font-medium text-green-600">
            {fmt(currentScenario.totalTax - result.optimal.totalTax)}
          </span>{" "}
          in total tax.
        </p>
      )}
    </div>
  );
}
