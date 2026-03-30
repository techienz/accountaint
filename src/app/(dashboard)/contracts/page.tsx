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

type Contract = {
  id: string;
  provider: string;
  service_name: string;
  category: string;
  cost: number;
  billing_cycle: string;
  start_date: string;
  renewal_date: string | null;
  auto_renew: boolean;
  status: string;
};

const categoryLabels: Record<string, string> = {
  telco: "Telco",
  software: "Software",
  insurance: "Insurance",
  leases: "Leases",
  banking_eftpos: "Banking/EFTPOS",
  professional_services: "Professional Services",
  other: "Other",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  expiring_soon: "outline",
  expired: "destructive",
  cancelled: "secondary",
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [summary, setSummary] = useState<{
    totalContracts: number;
    monthlyTotal: number;
    annualTotal: number;
    expiringCount: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((data) => {
        setContracts(data);
        // Calculate summary client-side
        const active = data.filter((c: Contract) => c.status !== "cancelled");
        let monthly = 0;
        for (const c of active) {
          if (c.billing_cycle === "monthly") monthly += c.cost;
          else if (c.billing_cycle === "quarterly") monthly += c.cost / 3;
          else if (c.billing_cycle === "annual") monthly += c.cost / 12;
        }
        setSummary({
          totalContracts: active.length,
          monthlyTotal: Math.round(monthly * 100) / 100,
          annualTotal: Math.round(monthly * 12 * 100) / 100,
          expiringCount: active.filter((c: Contract) => c.status === "expiring_soon").length,
        });
      });
  }, []);

  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contracts & Subscriptions</h1>
          <p className="text-muted-foreground">
            Track recurring business contracts and subscriptions
          </p>
        </div>
        <Link href="/contracts/new">
          <Button><Plus className="mr-2 h-4 w-4" />Add Contract</Button>
        </Link>
      </div>

      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Contracts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.totalContracts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fmt(summary.monthlyTotal)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Annual Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fmt(summary.annualTotal)}</p>
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
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Provider</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead>Cycle</TableHead>
            <TableHead>Renewal</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.map((c) => (
            <TableRow key={c.id} className="group cursor-pointer hover:bg-accent/50" onClick={() => window.location.href = `/contracts/${c.id}`}>
              <TableCell>
                <Link href={`/contracts/${c.id}`} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                  {c.provider}
                </Link>
              </TableCell>
              <TableCell>{c.service_name}</TableCell>
              <TableCell>{categoryLabels[c.category] || c.category}</TableCell>
              <TableCell className="text-right">{fmt(c.cost)}</TableCell>
              <TableCell className="capitalize">{c.billing_cycle}</TableCell>
              <TableCell>{c.renewal_date || "—"}</TableCell>
              <TableCell>
                <Badge variant={statusVariant[c.status] || "default"}>
                  {c.status === "expiring_soon" ? "Expiring Soon" : c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground flex items-center gap-1 transition-opacity">
                  View <ArrowRight className="h-3 w-3" />
                </span>
              </TableCell>
            </TableRow>
          ))}
          {contracts.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                No contracts yet. Add your first contract to start tracking.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
