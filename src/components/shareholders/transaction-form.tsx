"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  shareholderId: string;
  taxYear: string;
  onSuccess: () => void;
};

const TYPES = [
  { value: "drawing", label: "Drawing", defaultSign: 1 },
  { value: "repayment", label: "Repayment", defaultSign: -1 },
  { value: "salary", label: "Salary", defaultSign: -1 },
  { value: "dividend", label: "Dividend", defaultSign: -1 },
  { value: "other", label: "Other", defaultSign: 1 },
];

export function TransactionForm({ shareholderId, taxYear, onSuccess }: Props) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [type, setType] = useState("drawing");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const typeConfig = TYPES.find((t) => t.value === type);
    const signedAmount = Math.abs(Number(amount)) * (typeConfig?.defaultSign ?? 1);

    const res = await fetch(`/api/shareholders/${shareholderId}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tax_year: taxYear,
        date,
        type,
        description: description || null,
        amount: signedAmount,
      }),
    });

    if (res.ok) {
      setDescription("");
      setAmount("");
      onSuccess();
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4">
      <h3 className="font-medium">Add Transaction</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="tx-date">Date</Label>
          <Input
            id="tx-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="tx-type">Type</Label>
          <Select value={type} onValueChange={(v) => v && setType(v)}>
            <SelectTrigger id="tx-type">
              <SelectValue labels={Object.fromEntries(TYPES.map((t) => [t.value, t.label]))} />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="tx-amount">Amount ($)</Label>
          <Input
            id="tx-amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <Label htmlFor="tx-desc">Description</Label>
          <Input
            id="tx-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving..." : "Add Transaction"}
      </Button>
    </form>
  );
}
