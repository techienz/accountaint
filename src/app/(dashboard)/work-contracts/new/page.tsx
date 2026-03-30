"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const contractTypes = [
  { value: "hourly", label: "Hourly" },
  { value: "fixed_price", label: "Fixed Price" },
  { value: "retainer", label: "Retainer" },
];

const wtRates = [
  { value: "0.15", label: "15%" },
  { value: "0.20", label: "20%" },
  { value: "0.25", label: "25%" },
  { value: "0.30", label: "30%" },
  { value: "0.33", label: "33%" },
];

export default function NewWorkContractPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [contractType, setContractType] = useState("hourly");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const data = {
      client_name: form.get("client_name"),
      contract_type: form.get("contract_type"),
      hourly_rate: form.get("hourly_rate") ? Number(form.get("hourly_rate")) : null,
      weekly_hours: form.get("weekly_hours") ? Number(form.get("weekly_hours")) : null,
      fixed_price: form.get("fixed_price") ? Number(form.get("fixed_price")) : null,
      retainer_amount: form.get("retainer_amount") ? Number(form.get("retainer_amount")) : null,
      retainer_hours: form.get("retainer_hours") ? Number(form.get("retainer_hours")) : null,
      start_date: form.get("start_date"),
      end_date: form.get("end_date") || null,
      wt_rate: Number(form.get("wt_rate")),
      notes: form.get("notes") || null,
    };

    const res = await fetch("/api/work-contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      router.push("/work-contracts");
    }
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Add Work Contract</h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="client_name">Client Name</Label>
              <Input id="client_name" name="client_name" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contract_type">Contract Type</Label>
                <select
                  id="contract_type"
                  name="contract_type"
                  required
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  {contractTypes.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="wt_rate">Withholding Tax Rate</Label>
                <select
                  id="wt_rate"
                  name="wt_rate"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  {wtRates.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {contractType === "hourly" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
                  <Input id="hourly_rate" name="hourly_rate" type="number" step="0.01" />
                </div>
                <div>
                  <Label htmlFor="weekly_hours">Weekly Hours</Label>
                  <Input id="weekly_hours" name="weekly_hours" type="number" step="0.5" />
                </div>
              </div>
            )}

            {contractType === "fixed_price" && (
              <div>
                <Label htmlFor="fixed_price">Fixed Price ($)</Label>
                <Input id="fixed_price" name="fixed_price" type="number" step="0.01" />
              </div>
            )}

            {contractType === "retainer" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="retainer_amount">Monthly Retainer ($)</Label>
                  <Input id="retainer_amount" name="retainer_amount" type="number" step="0.01" />
                </div>
                <div>
                  <Label htmlFor="retainer_hours">Included Hours</Label>
                  <Input id="retainer_hours" name="retainer_hours" type="number" step="0.5" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date">Start Date</Label>
                <Input id="start_date" name="start_date" type="date" required />
              </div>
              <div>
                <Label htmlFor="end_date">End Date</Label>
                <Input id="end_date" name="end_date" type="date" placeholder="Leave blank for ongoing" />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Add Contract"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
