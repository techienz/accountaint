"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ReceiptUpload } from "./receipt-upload";

const categories = [
  { value: "office_supplies", label: "Office Supplies" },
  { value: "travel", label: "Travel" },
  { value: "meals_entertainment", label: "Meals & Entertainment" },
  { value: "professional_fees", label: "Professional Fees" },
  { value: "software_subscriptions", label: "Software/Subscriptions" },
  { value: "vehicle", label: "Vehicle" },
  { value: "home_office", label: "Home Office" },
  { value: "utilities", label: "Utilities" },
  { value: "insurance", label: "Insurance" },
  { value: "bank_fees", label: "Bank Fees" },
  { value: "other", label: "Other" },
];

type OcrData = {
  vendor?: string | null;
  date?: string | null;
  amount?: number | null;
  gst_amount?: number | null;
  category?: string | null;
  confidence?: string;
};

type ExpenseFormProps = {
  initialData?: {
    vendor?: string;
    description?: string;
    amount?: number;
    gst_amount?: number | null;
    category?: string;
    date?: string;
  };
  expenseId?: string;
  mode?: "create" | "edit";
};

export function ExpenseForm({ initialData, expenseId, mode = "create" }: ExpenseFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrData, setOcrData] = useState<OcrData | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const [vendor, setVendor] = useState(initialData?.vendor || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [amount, setAmount] = useState(initialData?.amount?.toString() || "");
  const [gstAmount, setGstAmount] = useState(initialData?.gst_amount?.toString() || "");
  const [category, setCategory] = useState(initialData?.category || "other");
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().slice(0, 10));

  async function handleReceiptUpload(file: File) {
    setReceiptFile(file);

    if (!file.type.startsWith("image/")) return;

    setOcrLoading(true);
    const formData = new FormData();
    formData.append("receipt", file);

    const res = await fetch("/api/expenses", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data.ocr) {
        setOcrData(data.ocr);
        // Pre-fill form with OCR data
        if (data.ocr.vendor) setVendor(data.ocr.vendor);
        if (data.ocr.amount) setAmount(String(data.ocr.amount));
        if (data.ocr.gst_amount) setGstAmount(String(data.ocr.gst_amount));
        if (data.ocr.category) setCategory(data.ocr.category);
        if (data.ocr.date) setDate(data.ocr.date);
      }
      // The expense was already created as draft — navigate to edit it
      if (data.id) {
        router.push(`/expenses/${data.id}`);
        return;
      }
    }
    setOcrLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const body = {
      vendor,
      description: description || null,
      amount: Number(amount),
      gst_amount: gstAmount ? Number(gstAmount) : null,
      category,
      date,
      status: "confirmed",
    };

    if (mode === "edit" && expenseId) {
      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) router.push("/expenses");
    } else {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) router.push("/expenses");
    }
    setSaving(false);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {mode === "create" && (
          <div className="mb-6">
            <Label>Receipt (optional)</Label>
            <ReceiptUpload onFileSelect={handleReceiptUpload} />
            {ocrLoading && (
              <p className="text-sm text-muted-foreground mt-2">
                Reading receipt...
              </p>
            )}
            {ocrData && (
              <p className="text-sm text-green-600 mt-2">
                Receipt processed ({ocrData.confidence} confidence). Review the details below.
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="vendor">Vendor</Label>
              <Input
                id="vendor"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="amount">Amount (incl. GST)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="gst_amount">GST Amount</Label>
              <Input
                id="gst_amount"
                type="number"
                step="0.01"
                value={gstAmount}
                onChange={(e) => setGstAmount(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving || ocrLoading}>
              {saving ? "Saving..." : mode === "edit" ? "Save Changes" : "Add Expense"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
