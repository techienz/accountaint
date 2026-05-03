"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

type PayoutMode = "split" | "retain";

type Scenario = {
  payoutMode: PayoutMode;
  salary: number;
  dividend: number;
  retainedEarnings: number;
  companyTax: number;
  personalTax: number;
  imputationCredits: number;
  accEarnerLevy: number;
  kiwisaverEmployer: number;
  kiwisaverEmployee: number;
  esct: number;
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

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

function ScenarioBreakdown({ s }: { s: Scenario }) {
  return (
    <div className="space-y-1 text-sm">
      {s.payoutMode === "retain" ? (
        <div className="flex justify-between">
          <span>Retained in company</span>
          <span>{fmt(s.retainedEarnings)}</span>
        </div>
      ) : (
        <>
          <div className="flex justify-between">
            <span>Salary</span>
            <span>{fmt(s.salary)}</span>
          </div>
          <div className="flex justify-between">
            <span>Dividend</span>
            <span>{fmt(s.dividend)}</span>
          </div>
        </>
      )}
      <div className="flex justify-between text-muted-foreground">
        <span>Company tax</span>
        <span>{fmt(s.companyTax)}</span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>Personal tax</span>
        <span>{fmt(s.personalTax)}</span>
      </div>
      {s.accEarnerLevy > 0 && (
        <div className="flex justify-between text-muted-foreground">
          <span>ACC earner levy</span>
          <span>{fmt(s.accEarnerLevy)}</span>
        </div>
      )}
      {s.esct > 0 && (
        <div className="flex justify-between text-muted-foreground">
          <span>ESCT (on KS employer)</span>
          <span>{fmt(s.esct)}</span>
        </div>
      )}
      {s.kiwisaverEmployer > 0 && (
        <div className="flex justify-between text-muted-foreground">
          <span>KiwiSaver employer</span>
          <span>{fmt(s.kiwisaverEmployer)}</span>
        </div>
      )}
      <div className="flex justify-between border-t pt-1 font-bold">
        <span>Total tax</span>
        <span>{fmt(s.totalTax)}</span>
      </div>
      <div className="text-muted-foreground">
        Effective rate: {(s.effectiveRate * 100).toFixed(1)}%
        {s.payoutMode === "retain" && (
          <span className="ml-2 italic">
            (personal tax deferred until distributed)
          </span>
        )}
      </div>
    </div>
  );
}

export function OptimiserPanel({ shareholderId }: Props) {
  const [companyProfit, setCompanyProfit] = useState(100000);
  const [otherIncome, setOtherIncome] = useState(0);
  const [kiwisaverEnrolled, setKiwisaverEnrolled] = useState(false);
  const [salary, setSalary] = useState(0);
  const [result, setResult] = useState<OptimiserResult | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      company_profit: String(companyProfit),
      other_income: String(otherIncome),
      kiwisaver_enrolled: String(kiwisaverEnrolled),
    });

    fetch(`/api/shareholders/${shareholderId}/optimise?${params}`)
      .then((r) => r.json())
      .then((data: OptimiserResult) => {
        setResult(data);
        setSalary(data.optimal.salary);
      });
  }, [shareholderId, companyProfit, otherIncome, kiwisaverEnrolled]);

  if (!result) return <div>Loading...</div>;

  // Match by salary AND payoutMode so the slider doesn't accidentally pick
  // up the retain scenario when salary=0.
  const currentScenario =
    result.scenarios.find(
      (s) => s.payoutMode === "split" && s.salary === salary
    ) || result.optimal;

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

      <div className="flex items-center gap-2">
        <input
          id="ks-enrolled"
          type="checkbox"
          checked={kiwisaverEnrolled}
          onChange={(e) => setKiwisaverEnrolled(e.target.checked)}
          className="h-4 w-4"
        />
        <Label htmlFor="ks-enrolled" className="cursor-pointer">
          Shareholder is enrolled in KiwiSaver (3% employer + 3% employee)
        </Label>
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
          <CardContent>
            <ScenarioBreakdown s={currentScenario} />
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Optimal Split
              {result.optimal.payoutMode === "retain" && (
                <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-xs font-normal text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                  retain in company
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScenarioBreakdown s={result.optimal} />
          </CardContent>
        </Card>
      </div>

      {currentScenario.totalTax > result.optimal.totalTax && (
        <p className="text-sm text-muted-foreground">
          Switching to the optimal split would save{" "}
          <span className="font-medium text-green-600">
            {fmt(currentScenario.totalTax - result.optimal.totalTax)}
          </span>{" "}
          in current-year tax
          {result.optimal.payoutMode === "retain" &&
            " (personal tax on the retained profit is deferred until you distribute it as a dividend)"}
          .
        </p>
      )}
    </div>
  );
}
