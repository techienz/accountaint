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

// Note: the underlying API + table is still named `contracts` (schema rename
// deferred under audit decision #121 Option C). This UI uses "subscription"
// throughout to disambiguate from work_contracts (client engagements).

type Subscription = {
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

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [summary, setSummary] = useState<{
    totalActive: number;
    monthlyTotal: number;
    annualTotal: number;
    expiringCount: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((data) => {
        setSubscriptions(data);
        const active = data.filter((c: Subscription) => c.status !== "cancelled");
        let monthly = 0;
        for (const c of active) {
          if (c.billing_cycle === "monthly") monthly += c.cost;
          else if (c.billing_cycle === "quarterly") monthly += c.cost / 3;
          else if (c.billing_cycle === "annual") monthly += c.cost / 12;
        }
        setSummary({
          totalActive: active.length,
          monthlyTotal: Math.round(monthly * 100) / 100,
          annualTotal: Math.round(monthly * 12 * 100) / 100,
          expiringCount: active.filter((c: Subscription) => c.status === "expiring_soon").length,
        });
      });
  }, []);

  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subscriptions</h1>
          <p className="text-muted-foreground">
            Track recurring business subscriptions (software, telco, insurance, leases). Distinct from <Link href="/work-contracts" className="underline">Work Contracts</Link>, which are client engagements.
          </p>
        </div>
        <Link href="/subscriptions/new">
          <Button><Plus className="mr-2 h-4 w-4" />Add subscription</Button>
        </Link>
      </div>

      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.totalActive}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Monthly cost</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fmt(summary.monthlyTotal)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Annual cost</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fmt(summary.annualTotal)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Expiring soon</CardTitle>
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
          {subscriptions.map((c) => (
            <TableRow key={c.id} className="group cursor-pointer hover:bg-accent/50" onClick={() => window.location.href = `/subscriptions/${c.id}`}>
              <TableCell>
                <Link href={`/subscriptions/${c.id}`} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
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
          {subscriptions.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                No subscriptions yet. Add your first subscription to start tracking.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
