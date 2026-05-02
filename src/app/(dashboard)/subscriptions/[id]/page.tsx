"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

type Contract = {
  id: string;
  provider: string;
  service_name: string;
  category: string;
  cost: number;
  billing_cycle: string;
  start_date: string;
  term_months: number | null;
  renewal_date: string | null;
  auto_renew: boolean;
  status: string;
  notes: string | null;
};

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

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  expiring_soon: "outline",
  expired: "destructive",
  cancelled: "secondary",
};

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [contract, setContract] = useState<Contract | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/contracts/${params.id}`)
      .then((r) => r.json())
      .then(setContract);
  }, [params.id]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
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

    const res = await fetch(`/api/contracts/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const updated = await res.json();
      setContract(updated);
      setEditing(false);
    }
    setSaving(false);
  }

  async function handleCancel() {
    if (!confirm("Cancel this subscription?")) return;
    const res = await fetch(`/api/contracts/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (res.ok) {
      const updated = await res.json();
      setContract(updated);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this subscription permanently?")) return;
    const res = await fetch(`/api/contracts/${params.id}`, { method: "DELETE" });
    if (res.ok) router.push("/subscriptions");
  }

  if (!contract) return <div>Loading...</div>;

  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  const statusLabel = contract.status === "expiring_soon"
    ? "Expiring Soon"
    : contract.status.charAt(0).toUpperCase() + contract.status.slice(1);

  if (editing) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">Edit subscription</h1>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="provider">Provider</Label>
                  <Input id="provider" name="provider" defaultValue={contract.provider} required />
                </div>
                <div>
                  <Label htmlFor="service_name">Service Name</Label>
                  <Input id="service_name" name="service_name" defaultValue={contract.service_name} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    name="category"
                    defaultValue={contract.category}
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
                    defaultValue={contract.billing_cycle}
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
                  <Input id="cost" name="cost" type="number" step="0.01" defaultValue={contract.cost} required />
                </div>
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input id="start_date" name="start_date" type="date" defaultValue={contract.start_date} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="term_months">Term (months)</Label>
                  <Input id="term_months" name="term_months" type="number" defaultValue={contract.term_months ?? ""} />
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <input id="auto_renew" name="auto_renew" type="checkbox" className="h-4 w-4" defaultChecked={contract.auto_renew} />
                  <Label htmlFor="auto_renew">Auto-renew</Label>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={3} defaultValue={contract.notes ?? ""} />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{contract.provider}</h1>
          <p className="text-muted-foreground">{contract.service_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant[contract.status] || "default"}>
            {statusLabel}
          </Badge>
          {contract.status !== "cancelled" && (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>Edit</Button>
              <Button variant="outline" onClick={handleCancel}>Cancel subscription</Button>
            </>
          )}
          <Button variant="destructive" onClick={handleDelete}>Delete</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(contract.cost)}</p>
            <p className="text-xs text-muted-foreground capitalize">{contract.billing_cycle}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Start Date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{contract.start_date}</p>
            {contract.term_months && (
              <p className="text-xs text-muted-foreground">{contract.term_months} month term</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Renewal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{contract.renewal_date || "Open-ended"}</p>
            <p className="text-xs text-muted-foreground">
              {contract.auto_renew ? "Auto-renew enabled" : "Manual renewal"}
            </p>
          </CardContent>
        </Card>
      </div>

      {contract.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{contract.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
