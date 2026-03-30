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

type Invoice = {
  id: string;
  invoice_number: string;
  type: string;
  status: string;
  date: string;
  due_date: string;
  total: number;
  amount_due: number;
  contact_name: string;
};

type Summary = {
  totalReceivable: number;
  totalPayable: number;
  overdueCount: number;
  overdueAmount: number;
  draftCount: number;
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  sent: "default",
  paid: "secondary",
  overdue: "destructive",
  void: "secondary",
};

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tab, setTab] = useState<"ACCREC" | "ACCPAY">("ACCREC");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then(setInvoices);
    fetch("/api/invoices/summary")
      .then((r) => r.json())
      .then(setSummary);
  }, []);

  const filtered = invoices
    .filter((inv) => inv.type === tab)
    .filter((inv) => statusFilter === "all" || inv.status === statusFilter);

  const isInvoiceTab = tab === "ACCREC";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">
            Manage sales invoices and bills
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/invoices/new?type=ACCPAY">
            <Button variant="outline"><Plus className="mr-2 h-4 w-4" />New Bill</Button>
          </Link>
          <Link href="/invoices/new?type=ACCREC">
            <Button><Plus className="mr-2 h-4 w-4" />New Invoice</Button>
          </Link>
        </div>
      </div>

      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Receivable</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fmt(summary.totalReceivable)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Payable</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fmt(summary.totalPayable)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${summary.overdueCount > 0 ? "text-red-600" : ""}`}>
                {summary.overdueCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Drafts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.draftCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => setTab("ACCREC")}
          className={`pb-2 text-sm font-medium ${
            tab === "ACCREC"
              ? "border-b-2 border-foreground text-foreground"
              : "text-muted-foreground"
          }`}
        >
          Sales Invoices
        </button>
        <button
          onClick={() => setTab("ACCPAY")}
          className={`pb-2 text-sm font-medium ${
            tab === "ACCPAY"
              ? "border-b-2 border-foreground text-foreground"
              : "text-muted-foreground"
          }`}
        >
          Bills
        </button>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2">
        {["all", "draft", "sent", "paid", "overdue"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              statusFilter === s
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{isInvoiceTab ? "Invoice #" : "Bill #"}</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Amount Due</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((inv) => (
            <TableRow key={inv.id} className="group cursor-pointer hover:bg-accent/50" onClick={() => window.location.href = `/invoices/${inv.id}`}>
              <TableCell>
                <Link href={`/invoices/${inv.id}`} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                  {inv.invoice_number}
                </Link>
              </TableCell>
              <TableCell>{inv.contact_name}</TableCell>
              <TableCell>{inv.date}</TableCell>
              <TableCell>{inv.due_date}</TableCell>
              <TableCell className="text-right">{fmt(inv.total)}</TableCell>
              <TableCell className="text-right">{fmt(inv.amount_due)}</TableCell>
              <TableCell>
                <Badge variant={statusVariant[inv.status] || "default"}>
                  {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground flex items-center gap-1 transition-opacity">
                  View <ArrowRight className="h-3 w-3" />
                </span>
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                No {isInvoiceTab ? "invoices" : "bills"} found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
