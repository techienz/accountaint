"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExpenseForm } from "@/components/expenses/expense-form";

type Expense = {
  id: string;
  vendor: string;
  description: string | null;
  amount: number;
  gst_amount: number | null;
  category: string;
  date: string;
  receipt_path: string | null;
  receipt_mime: string | null;
  status: string;
  ocr_raw: string | null;
  linked_asset_id: string | null;
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

export default function ExpenseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetch(`/api/expenses/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setExpense(data);
        // Auto-enter edit mode for drafts
        if (data.status === "draft") setEditing(true);
      });
  }, [params.id]);

  async function handleDelete() {
    if (!confirm("Delete this expense?")) return;
    const res = await fetch(`/api/expenses/${params.id}`, { method: "DELETE" });
    if (res.ok) router.push("/expenses");
  }

  if (!expense) return <div>Loading...</div>;

  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  if (editing) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">
          {expense.status === "draft" ? "Review Expense" : "Edit Expense"}
        </h1>
        <ExpenseForm
          mode="edit"
          expenseId={expense.id}
          initialData={{
            vendor: expense.vendor,
            description: expense.description || "",
            amount: expense.amount,
            gst_amount: expense.gst_amount,
            category: expense.category,
            date: expense.date,
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{expense.vendor}</h1>
          <p className="text-muted-foreground">
            {categoryLabels[expense.category] || expense.category} · {expense.date}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={expense.status === "confirmed" ? "default" : "secondary"}>
            {expense.status === "confirmed" ? "Confirmed" : "Draft"}
          </Badge>
          <Button variant="outline" onClick={() => setEditing(true)}>Edit</Button>
          <Button variant="destructive" onClick={handleDelete}>Delete</Button>
        </div>
      </div>

      {expense.status === "confirmed" &&
        !expense.linked_asset_id &&
        expense.amount >= 1000 &&
        ["office_supplies", "software_subscriptions", "vehicle", "other"].includes(expense.category) && (
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
          <AlertDescription className="flex items-center justify-between">
            <span>
              This {fmt(expense.amount)} purchase could be a fixed asset with tax depreciation benefits.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const exGst = expense.gst_amount
                  ? expense.amount - expense.gst_amount
                  : expense.amount;
                const categoryMap: Record<string, string> = {
                  office_supplies: "Computers",
                  software_subscriptions: "Software",
                  vehicle: "Motor Vehicles",
                  other: "Office Equipment",
                };
                const params = new URLSearchParams({
                  name: expense.vendor,
                  cost: exGst.toFixed(2),
                  purchase_date: expense.date,
                  category: categoryMap[expense.category] || "Office Equipment",
                  from_expense_id: expense.id,
                });
                router.push(`/assets/new?${params.toString()}`);
              }}
            >
              Add to Asset Register
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {expense.linked_asset_id && (
        <p className="text-sm text-muted-foreground">
          Linked to asset:{" "}
          <a href={`/assets/${expense.linked_asset_id}`} className="text-primary hover:underline">
            View asset
          </a>
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Amount (incl. GST)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(expense.amount)}</p>
          </CardContent>
        </Card>
        {expense.gst_amount != null && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">GST</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fmt(expense.gst_amount)}</p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{expense.date}</p>
          </CardContent>
        </Card>
      </div>

      {expense.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{expense.description}</p>
          </CardContent>
        </Card>
      )}

      {expense.receipt_path && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Receipt</CardTitle>
          </CardHeader>
          <CardContent>
            {expense.receipt_mime?.startsWith("image/") ? (
              <img
                src={`/api/expenses/${expense.id}/receipt`}
                alt="Receipt"
                className="max-h-96 rounded-md border"
              />
            ) : (
              <a
                href={`/api/expenses/${expense.id}/receipt`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                View receipt
              </a>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
