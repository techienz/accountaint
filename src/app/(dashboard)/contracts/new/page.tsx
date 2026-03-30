"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const categories = [
  { value: "telco", label: "Telco" },
  { value: "software", label: "Software" },
  { value: "insurance", label: "Insurance" },
  { value: "leases", label: "Leases" },
  { value: "banking_eftpos", label: "Banking/EFTPOS" },
  { value: "professional_services", label: "Professional Services" },
  { value: "other", label: "Other" },
];

const billingCycles = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
];

export default function NewContractPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const data = {
      provider: form.get("provider"),
      service_name: form.get("service_name"),
      category: form.get("category"),
      cost: Number(form.get("cost")),
      billing_cycle: form.get("billing_cycle"),
      start_date: form.get("start_date"),
      term_months: form.get("term_months") ? Number(form.get("term_months")) : null,
      auto_renew: form.get("auto_renew") === "on",
      notes: form.get("notes") || null,
    };

    const res = await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      router.push("/contracts");
    }
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Add Contract</h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="provider">Provider</Label>
                <Input id="provider" name="provider" required />
              </div>
              <div>
                <Label htmlFor="service_name">Service Name</Label>
                <Input id="service_name" name="service_name" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  name="category"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="billing_cycle">Billing Cycle</Label>
                <select
                  id="billing_cycle"
                  name="billing_cycle"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  {billingCycles.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cost">Cost ($)</Label>
                <Input id="cost" name="cost" type="number" step="0.01" required />
              </div>
              <div>
                <Label htmlFor="start_date">Start Date</Label>
                <Input id="start_date" name="start_date" type="date" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="term_months">Term (months)</Label>
                <Input id="term_months" name="term_months" type="number" placeholder="Leave blank for open-ended" />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <input id="auto_renew" name="auto_renew" type="checkbox" className="h-4 w-4" />
                <Label htmlFor="auto_renew">Auto-renew</Label>
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
