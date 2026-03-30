"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Income = {
  label: string;
  monthly_amount: number;
};

export function OverviewSummary({
  incomes,
  totalIncome,
  totalExpenses,
  totalDebt,
  totalDebtBalance,
  totalBankBalance,
  totalInvestmentValue,
  netWorth,
  totalSavings,
  remaining,
  isFortnightly,
  convert,
}: {
  incomes: Income[];
  totalIncome: number;
  totalExpenses: number;
  totalDebt: number;
  totalDebtBalance?: number;
  totalBankBalance?: number;
  totalInvestmentValue?: number;
  netWorth?: number;
  totalSavings: number;
  remaining: number;
  isFortnightly: boolean;
  convert: (v: number) => number;
}) {
  const display = (v: number) => fmt(isFortnightly ? convert(v) : v);

  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Income</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-green-600">{display(totalIncome)}</p>
          <div className="mt-2 space-y-1">
            {incomes.map((i) => (
              <div key={i.label} className="flex justify-between text-sm text-muted-foreground">
                <span>{i.label}</span>
                <span>{display(i.monthly_amount)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{display(totalExpenses)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Debt + Savings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{display(totalDebt + totalSavings)}</p>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Debt repayments</span>
              <span>{display(totalDebt)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Savings</span>
              <span>{display(totalSavings)}</span>
            </div>
          </div>
          {totalDebtBalance != null && totalDebtBalance > 0 && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total debt owed</span>
                <span className="font-medium text-red-600">{fmt(totalDebtBalance)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Remaining</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-2xl font-bold ${remaining >= 0 ? "text-green-600" : "text-red-600"}`}>
            {display(remaining)}
          </p>
        </CardContent>
      </Card>

      {netWorth != null && (totalBankBalance ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${netWorth >= 0 ? "text-green-600" : "text-red-600"}`}>
              {fmt(netWorth)}
            </p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Bank accounts</span>
                <span>{fmt(totalBankBalance ?? 0)}</span>
              </div>
              {totalInvestmentValue != null && totalInvestmentValue > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Investments</span>
                  <span>{fmt(totalInvestmentValue)}</span>
                </div>
              )}
              {totalDebtBalance != null && totalDebtBalance > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Debts</span>
                  <span className="text-red-600">-{fmt(totalDebtBalance)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
