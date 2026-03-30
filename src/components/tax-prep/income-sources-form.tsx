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
  onSuccess: () => void;
};

const SOURCE_TYPES = [
  { value: "employment", label: "Employment" },
  { value: "rental", label: "Rental Income" },
  { value: "interest", label: "Interest" },
  { value: "dividends_other", label: "Other Dividends" },
  { value: "other", label: "Other" },
];

export function IncomeSourcesForm({ shareholderId, onSuccess }: Props) {
  const [sourceType, setSourceType] = useState("rental");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [taxPaid, setTaxPaid] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const res = await fetch("/api/tax-prep/personal-income", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shareholder_id: shareholderId,
        source_type: sourceType,
        description: description || null,
        amount: Number(amount),
        tax_paid: Number(taxPaid) || 0,
      }),
    });

    if (res.ok) {
      setDescription("");
      setAmount("");
      setTaxPaid("");
      onSuccess();
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border p-4">
      <h4 className="text-sm font-medium">Add Income Source</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Type</Label>
          <Select value={sourceType} onValueChange={(v) => v && setSourceType(v)}>
            <SelectTrigger>
              <SelectValue labels={Object.fromEntries(SOURCE_TYPES.map((t) => [t.value, t.label]))} />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Description</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Rental property"
          />
        </div>
        <div>
          <Label>Amount ($)</Label>
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Tax Already Paid ($)</Label>
          <Input
            type="number"
            step="0.01"
            value={taxPaid}
            onChange={(e) => setTaxPaid(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Saving..." : "Add"}
      </Button>
    </form>
  );
}
