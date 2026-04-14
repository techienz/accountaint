"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Calculator, AlertTriangle, Info } from "lucide-react";

type BreakdownItem = { label: string; amount: number };
type RateComparison = {
  rate: number;
  wtCollected: number;
  surplus: number;
  isRecommended: boolean;
};
type WtResult = {
  recommendedRate: number;
  idealRate: number;
  totalWtNeeded: number;
  breakdown: BreakdownItem[];
  rateComparison: RateComparison[];
  warnings: string[];
};

const fmt = (n: number) =>
  "$" +
  Math.abs(n).toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtSigned = (n: number) => (n < 0 ? "-" + fmt(n) : fmt(n));

export default function WtAdvisorPage() {
  const [contractIncome, setContractIncome] = useState("");
  const [otherEmploymentIncome, setOtherEmploymentIncome] = useState("");
  const [otherIncome, setOtherIncome] = useState("");
  const [claimableExpenses, setClaimableExpenses] = useState("");
  const [hasStudentLoan, setHasStudentLoan] = useState(false);
  const [includeAccLevy, setIncludeAccLevy] = useState(true);
  const [result, setResult] = useState<WtResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Pre-fill contract income from active contracts
  useEffect(() => {
    fetch("/api/work-contracts/summary")
      .then((r) => r.json())
      .then((data) => {
        if (data?.totalMonthlyGross) {
          const annual = Math.round(data.totalMonthlyGross * 12);
          setContractIncome(String(annual));
        }
      })
      .catch(() => {});
  }, []);

  async function calculate() {
    setLoading(true);
    try {
      const res = await fetch("/api/calculators/wt-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractIncome: Number(contractIncome) || 0,
          otherEmploymentIncome: Number(otherEmploymentIncome) || 0,
          otherIncome: Number(otherIncome) || 0,
          claimableExpenses: Number(claimableExpenses) || 0,
          hasStudentLoan,
          includeAccLevy,
        }),
      });
      if (res.ok) {
        setResult(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/work-contracts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">WT Rate Advisor</h1>
          <p className="text-muted-foreground">
            Find the right withholding tax rate for your IR330C
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Income & Expenses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="contractIncome">
                Expected annual contract income (gross)
              </Label>
              <Input
                id="contractIncome"
                type="number"
                min="0"
                step="100"
                placeholder="0"
                value={contractIncome}
                onChange={(e) => setContractIncome(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Pre-filled from your active work contracts
              </p>
            </div>

            <div>
              <Label htmlFor="otherEmploymentIncome">
                Other employment income (PAYE salary/wages)
              </Label>
              <Input
                id="otherEmploymentIncome"
                type="number"
                min="0"
                step="100"
                placeholder="0"
                value={otherEmploymentIncome}
                onChange={(e) => setOtherEmploymentIncome(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="otherIncome">
                Other income (interest, rental, etc.)
              </Label>
              <Input
                id="otherIncome"
                type="number"
                min="0"
                step="100"
                placeholder="0"
                value={otherIncome}
                onChange={(e) => setOtherIncome(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="claimableExpenses">
                Claimable business expenses (annual estimate)
              </Label>
              <Input
                id="claimableExpenses"
                type="number"
                min="0"
                step="100"
                placeholder="0"
                value={claimableExpenses}
                onChange={(e) => setClaimableExpenses(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <Label htmlFor="studentLoan">Student loan</Label>
                <p className="text-xs text-muted-foreground">
                  Adds 12% repayment on income above threshold
                </p>
              </div>
              <Switch
                id="studentLoan"
                checked={hasStudentLoan}
                onCheckedChange={setHasStudentLoan}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="accLevy">Include ACC earner levy</Label>
                <p className="text-xs text-muted-foreground">
                  Most contractors should include this
                </p>
              </div>
              <Switch
                id="accLevy"
                checked={includeAccLevy}
                onCheckedChange={setIncludeAccLevy}
              />
            </div>

            <Button onClick={calculate} disabled={loading} className="w-full">
              <Calculator className="mr-2 h-4 w-4" />
              {loading ? "Calculating..." : "Calculate Recommended Rate"}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Recommended Rate */}
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  Recommended WT Rate
                </p>
                <p className="text-5xl font-bold text-primary">
                  {Math.round(result.recommendedRate * 100)}%
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Ideal rate: {(result.idealRate * 100).toFixed(1)}% — rounded
                  up to nearest standard rate
                </p>
              </CardContent>
            </Card>

            {/* Warnings */}
            {result.warnings.map((w, i) => (
              <Alert key={i} variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{w}</AlertDescription>
              </Alert>
            ))}

            {/* Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Calculation Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    {result.breakdown.map((item, i) => {
                      const isTotal =
                        item.label === "Total WT needed from contracts" ||
                        item.label === "Estimated taxable income" ||
                        item.label === "Total gross income";
                      return (
                        <TableRow key={i}>
                          <TableCell
                            className={isTotal ? "font-semibold" : ""}
                          >
                            {item.label}
                          </TableCell>
                          <TableCell
                            className={`text-right ${isTotal ? "font-semibold" : ""}`}
                          >
                            {fmtSigned(item.amount)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Rate Comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Rate Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rate</TableHead>
                      <TableHead className="text-right">
                        WT Collected
                      </TableHead>
                      <TableHead className="text-right">
                        Surplus / Shortfall
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rateComparison.map((r) => (
                      <TableRow
                        key={r.rate}
                        className={r.isRecommended ? "bg-primary/5" : ""}
                      >
                        <TableCell>
                          {Math.round(r.rate * 100)}%
                          {r.isRecommended && (
                            <Badge className="ml-2" variant="secondary">
                              Recommended
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(r.wtCollected)}
                        </TableCell>
                        <TableCell
                          className={`text-right ${r.surplus < 0 ? "text-red-600" : "text-green-600"}`}
                        >
                          {r.surplus >= 0 ? "+" : "-"}
                          {fmt(r.surplus)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Disclaimer */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                This is an estimate only. Your actual tax liability may differ
                based on deductions, credits, and timing. Consult a tax
                professional for personalised advice.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    </div>
  );
}
