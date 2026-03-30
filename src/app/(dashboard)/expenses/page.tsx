"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CategoryBreakdown } from "@/components/expenses/category-breakdown";
import { Plus, ArrowRight } from "lucide-react";

type Expense = {
  id: string;
  vendor: string;
  description: string | null;
  amount: number;
  gst_amount: number | null;
  category: string;
  date: string;
  receipt_path: string | null;
  status: string;
};

type Summary = {
  totalExpenses: number;
  grandTotal: number;
  grandGst: number;
  byCategory: { category: string; count: number; total: number; gstTotal: number }[];
};

const categoryLabels: Record<string, string> = {
  office_supplies: "Office Supplies",
  travel: "Travel",
  meals_entertainment: "Meals & Entertainment",
  professional_fees: "Professional Fees",
  software_subscriptions: "Software/Subscriptions",
  vehicle: "Vehicle",
  home_office: "Home Office",
  utilities: "Utilities",
  insurance: "Insurance",
  bank_fees: "Bank Fees",
  other: "Other",
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    fetch("/api/expenses").then((r) => r.json()).then(setExpenses);
    fetch("/api/expenses/summary").then((r) => r.json()).then(setSummary);
  }, []);

  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">
            Track business expenses and receipts
          </p>
        </div>
        <Link href="/expenses/new">
          <Button><Plus className="mr-2 h-4 w-4" />Add Expense</Button>
        </Link>
      </div>

      {summary && (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="grid gap-4 grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold">{summary.totalExpenses}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold">{fmt(summary.grandTotal)}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Total GST</p>
                <p className="text-2xl font-bold">{fmt(summary.grandGst)}</p>
              </div>
            </div>
          </div>
          <CategoryBreakdown data={summary.byCategory} grandTotal={summary.grandTotal} />
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Receipt</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((exp) => (
            <TableRow key={exp.id} className="group cursor-pointer hover:bg-accent/50" onClick={() => window.location.href = `/expenses/${exp.id}`}>
              <TableCell>{exp.date}</TableCell>
              <TableCell>
                <Link href={`/expenses/${exp.id}`} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                  {exp.vendor}
                </Link>
              </TableCell>
              <TableCell>{categoryLabels[exp.category] || exp.category}</TableCell>
              <TableCell className="text-right">{fmt(exp.amount)}</TableCell>
              <TableCell>
                {exp.receipt_path ? (
                  <Badge variant="outline">Yes</Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={exp.status === "confirmed" ? "default" : "secondary"}>
                  {exp.status === "confirmed" ? "Confirmed" : "Draft"}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground flex items-center gap-1 transition-opacity">
                  View <ArrowRight className="h-3 w-3" />
                </span>
              </TableCell>
            </TableRow>
          ))}
          {expenses.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No expenses yet. Add your first expense to start tracking.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
