"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SavingsSummary } from "@/components/tax-savings/savings-summary";
import { MonthlyTable } from "@/components/tax-savings/monthly-table";
import { SetPageContext } from "@/components/page-context-provider";
import { PAGE_CONTEXTS } from "@/lib/help/page-context";

type MonthlyTarget = {
  month: string;
  gstComponent: number;
  incomeTaxComponent: number;
  totalTarget: number;
  actualSetAside: number | null;
};

type SavingsData = {
  gstOwed: number;
  gstSource: "xero" | "invoices" | "contracts" | "none";
  estimatedIncomeTax: number;
  estimatedProfit: number;
  incomeSource: "xero" | "contracts" | "none";
  totalToSetAside: number;
  monthlyBreakdown: MonthlyTarget[];
  totalActualSetAside: number;
  shortfallOrSurplus: number;
};

export default function TaxSavingsPage() {
  const [data, setData] = useState<SavingsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadData() {
    fetch("/api/tax-savings")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load (${r.status})`);
        return r.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    loadData();
  }, []);

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Tax Savings Calculator</h1>
        <p className="text-muted-foreground">
          Unable to load tax savings data: {error}. Try syncing your Xero data first.
        </p>
      </div>
    );
  }

  if (!data) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tax Savings Calculator</h1>
        <p className="text-muted-foreground">
          How much to set aside for GST and income tax
        </p>
      </div>

      <SavingsSummary
        totalToSetAside={data.totalToSetAside}
        totalActualSetAside={data.totalActualSetAside}
        shortfallOrSurplus={data.shortfallOrSurplus}
        gstOwed={data.gstOwed}
        gstSource={data.gstSource}
        estimatedIncomeTax={data.estimatedIncomeTax}
        estimatedProfit={data.estimatedProfit}
        incomeSource={data.incomeSource}
      />

      <MonthlyTable
        months={data.monthlyBreakdown}
        onUpdate={loadData}
      />
    </div>
  );
}
