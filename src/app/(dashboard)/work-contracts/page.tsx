"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, ArrowRight } from "lucide-react";

type WorkContract = {
  id: string;
  client_name: string;
  contract_type: string;
  hourly_rate: number | null;
  weekly_hours: number | null;
  fixed_price: number | null;
  retainer_amount: number | null;
  retainer_hours: number | null;
  start_date: string;
  end_date: string | null;
  wt_rate: number;
  status: string;
};

type Summary = {
  totalContracts: number;
  activeContracts: number;
  totalWeeklyHours: number;
  totalProjectedEarnings: number;
  expiringCount: number;
  totalDailyGross?: number;
  totalFortnightlyGross?: number;
  totalMonthlyGross?: number;
  totalFortnightlyNet?: number;
  totalMonthlyNet?: number;
};

const typeLabels: Record<string, string> = {
  hourly: "Hourly",
  fixed_price: "Fixed Price",
  retainer: "Retainer",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  expiring_soon: "outline",
  expired: "destructive",
  completed: "secondary",
  cancelled: "secondary",
};

function formatRate(contract: WorkContract): string {
  if (contract.contract_type === "hourly" && contract.hourly_rate) {
    return `$${contract.hourly_rate.toLocaleString("en-NZ")}/hr`;
  }
  if (contract.contract_type === "fixed_price" && contract.fixed_price) {
    return `$${contract.fixed_price.toLocaleString("en-NZ")}`;
  }
  if (contract.contract_type === "retainer" && contract.retainer_amount) {
    return `$${contract.retainer_amount.toLocaleString("en-NZ")}/mo`;
  }
  return "—";
}

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

export default function WorkContractsPage() {
  const [contracts, setContracts] = useState<WorkContract[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    fetch("/api/work-contracts")
      .then((r) => r.json())
      .then(setContracts);
    fetch("/api/work-contracts/summary")
      .then((r) => r.json())
      .then(setSummary);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Work Contracts</h1>
          <p className="text-muted-foreground">
            Track client engagements, rates, and withholding tax
          </p>
        </div>
        <Link href="/work-contracts/new">
          <Button><Plus className="mr-2 h-4 w-4" />Add Contract</Button>
        </Link>
      </div>

      {summary && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active Contracts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{summary.activeContracts}</p>
                <p className="text-xs text-muted-foreground">{summary.totalWeeklyHours} hrs/week</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Fortnightly (gross)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{fmt(summary.totalFortnightlyGross ?? 0)}</p>
                <p className="text-xs text-muted-foreground">Daily: {fmt(summary.totalDailyGross ?? 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Monthly (net)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">{fmt(summary.totalMonthlyNet ?? 0)}</p>
                <p className="text-xs text-muted-foreground">Gross: {fmt(summary.totalMonthlyGross ?? 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${summary.expiringCount > 0 ? "text-amber-600" : ""}`}>
                  {summary.expiringCount}
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead className="text-right">Weekly Hrs</TableHead>
            <TableHead>Start</TableHead>
            <TableHead>End</TableHead>
            <TableHead>WT%</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.map((c) => (
            <TableRow key={c.id} className="group cursor-pointer hover:bg-accent/50" onClick={() => window.location.href = `/work-contracts/${c.id}`}>
              <TableCell>
                <span className="font-medium text-primary">
                  {c.client_name}
                </span>
              </TableCell>
              <TableCell>{typeLabels[c.contract_type] || c.contract_type}</TableCell>
              <TableCell>{formatRate(c)}</TableCell>
              <TableCell className="text-right">{c.weekly_hours ?? "—"}</TableCell>
              <TableCell>{c.start_date}</TableCell>
              <TableCell>{c.end_date || "Ongoing"}</TableCell>
              <TableCell>{Math.round(c.wt_rate * 100)}%</TableCell>
              <TableCell>
                <Badge variant={statusVariant[c.status] || "default"}>
                  {c.status === "expiring_soon" ? "Expiring Soon" : c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                </Badge>
              </TableCell>
              <TableCell>
                <Link href={`/work-contracts/${c.id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100">
                  View <ArrowRight className="h-3 w-3" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
          {contracts.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                No work contracts yet. Add your first contract to start tracking.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
