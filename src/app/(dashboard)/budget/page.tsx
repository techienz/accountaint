"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FortnightToggle } from "@/components/budget/fortnight-toggle";
import { OverviewSummary } from "@/components/budget/overview-summary";
import { CategoryBreakdown } from "@/components/budget/category-breakdown";
import { ThisFortnight } from "@/components/budget/this-fortnight";
import { FileSpreadsheet } from "lucide-react";

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function monthlyToFortnightly(monthly: number): number {
  return Math.round((monthly * 12) / 26 * 100) / 100;
}

type Overview = {
  totalMonthlyIncome: number;
  totalFortnightlyIncome: number;
  totalMonthlyExpenses: number;
  totalFortnightlyExpenses: number;
  totalMonthlyDebt: number;
  totalDebtBalance: number;
  totalBankBalance: number;
  totalSavingsBalance: number;
  totalInvestmentValue: number;
  netWorth: number;
  totalMonthlySavings: number;
  monthlyRemaining: number;
  fortnightlyRemaining: number;
  categoryBreakdown: {
    id: string;
    name: string;
    color: string | null;
    monthlyTotal: number;
    fortnightlyTotal: number;
    itemCount: number;
  }[];
  thisFortnightItems: {
    name: string;
    monthly_amount: number;
    due_day: number | null;
  }[];
  upcomingOneOffs: {
    name: string;
    amount: number;
    date: string;
  }[];
  holidayForecast: number;
  incomes: {
    label: string;
    monthly_amount: number;
  }[];
  period: {
    start: string;
    end: string;
  };
};

export default function BudgetPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [mode, setMode] = useState<"fortnightly" | "monthly">("fortnightly");

  useEffect(() => {
    fetch("/api/budget/overview")
      .then((r) => r.json())
      .then(setOverview);
  }, []);

  if (!overview) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Personal Budget</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  const isFortnightly = mode === "fortnightly";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Personal Budget</h1>
          <p className="text-muted-foreground">
            Track income, expenses, and savings goals
          </p>
        </div>
        <div className="flex items-center gap-3">
          <FortnightToggle mode={mode} onChange={setMode} />
          <Link href="/budget/import">
            <Button variant="outline">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Import
            </Button>
          </Link>
        </div>
      </div>

      <OverviewSummary
        incomes={overview.incomes}
        totalIncome={overview.totalMonthlyIncome}
        totalExpenses={overview.totalMonthlyExpenses}
        totalDebt={overview.totalMonthlyDebt}
        totalDebtBalance={overview.totalDebtBalance}
        totalBankBalance={overview.totalBankBalance}
        totalInvestmentValue={overview.totalInvestmentValue}
        netWorth={overview.netWorth}
        totalSavings={overview.totalMonthlySavings}
        remaining={overview.monthlyRemaining}
        isFortnightly={isFortnightly}
        convert={monthlyToFortnightly}
      />

      <div className="grid gap-5 md:grid-cols-2">
        <CategoryBreakdown
          categories={overview.categoryBreakdown}
          isFortnightly={isFortnightly}
        />
        <ThisFortnight
          items={overview.thisFortnightItems}
          periodStart={
            typeof overview.period.start === "string"
              ? overview.period.start
              : new Date(overview.period.start).toISOString().slice(0, 10)
          }
          periodEnd={
            typeof overview.period.end === "string"
              ? overview.period.end
              : new Date(overview.period.end).toISOString().slice(0, 10)
          }
        />
      </div>

      {/* Upcoming one-offs */}
      {overview.upcomingOneOffs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Upcoming One-off Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overview.upcomingOneOffs.slice(0, 5).map((o, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <div>
                    <span>{o.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{o.date}</span>
                  </div>
                  <span className="font-medium">{fmt(o.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Holiday forecast */}
      {overview.holidayForecast > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Holiday Forecast</CardTitle>
            <Link href="/budget/holidays" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(overview.holidayForecast)}</p>
            <p className="text-xs text-muted-foreground mt-1">Total planned holiday spending</p>
          </CardContent>
        </Card>
      )}

      {/* Quick links */}
      <div className="grid gap-3 md:grid-cols-4">
        <Link href="/budget/recurring">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="pt-6 text-center">
              <p className="text-sm font-medium">Bills & Income</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/budget/debts">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="pt-6 text-center">
              <p className="text-sm font-medium">Debts</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/budget/savings">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="pt-6 text-center">
              <p className="text-sm font-medium">Savings Goals</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/budget/holidays">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="pt-6 text-center">
              <p className="text-sm font-medium">Holidays</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
