"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { EarningsCard } from "@/components/work-contracts/earnings-card";
import { ArrowLeft } from "lucide-react";

type WorkContract = {
  id: string;
  client_name: string;
  contract_type: string;
  hourly_rate: number | null;
  weekly_hours: number | null;
  fixed_price: number | null;
  retainer_amount: number | null;
  retainer_hours: number | null;
  start_date: string;
  end_date: string | null;
  wt_rate: number;
  document_id: string | null;
  project_name: string | null;
  project_code: string | null;
  billing_cycle: string | null;
  invoice_due_day: number | null;
  invoice_send_day: number | null;
  status: string;
  notes: string | null;
};

type TimesheetEntry = {
  id: string;
  date: string;
  duration_minutes: number;
  description: string | null;
  billable: boolean;
  status: string;
};

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

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  expiring_soon: "outline",
  expired: "destructive",
  completed: "secondary",
  cancelled: "secondary",
};

function calculateProjection(c: WorkContract) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let gross = 0;

  if (c.contract_type === "hourly") {
    const rate = c.hourly_rate ?? 0;
    const weeklyHrs = c.weekly_hours ?? 0;
    if (c.end_date) {
      const end = new Date(c.end_date);
      const weeks = Math.max(0, (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 7));
      gross = rate * weeklyHrs * weeks;
    } else {
      gross = rate * weeklyHrs * 52;
    }
  } else if (c.contract_type === "fixed_price") {
    gross = c.fixed_price ?? 0;
  } else if (c.contract_type === "retainer") {
    const monthly = c.retainer_amount ?? 0;
    if (c.end_date) {
      const end = new Date(c.end_date);
      const months = Math.max(0, (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
      gross = monthly * months;
    } else {
      gross = monthly * 12;
    }
  }

  const wt = gross * c.wt_rate;
  return {
    grossProjected: Math.round(gross * 100) / 100,
    wtAmount: Math.round(wt * 100) / 100,
    netProjected: Math.round((gross - wt) * 100) / 100,
  };
}

export default function WorkContractDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [contract, setContract] = useState<WorkContract | null>(null);
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contractType, setContractType] = useState("hourly");
  const [budgetLinked, setBudgetLinked] = useState(false);

  useEffect(() => {
    fetch(`/api/work-contracts/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setContract(data);
        setContractType(data.contract_type);
      });
    fetch(`/api/timesheets?work_contract_id=${params.id}`)
      .then((r) => r.json())
      .then((data) => setEntries(data.slice(0, 10)));
    // Check if linked to budget
    fetch(`/api/budget/link-contract?contract_id=${params.id}`)
      .then((r) => r.json())
      .then((data) => setBudgetLinked(data.linked === true))
      .catch(() => setBudgetLinked(false));
  }, [params.id]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
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
      project_name: form.get("project_name") || null,
      project_code: form.get("project_code") || null,
      billing_cycle: form.get("billing_cycle") || null,
      invoice_send_day: Number(form.get("invoice_send_day")) || null,
      invoice_due_day: Number(form.get("invoice_due_day")) || null,
      notes: form.get("notes") || null,
    };

    const res = await fetch(`/api/work-contracts/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const updated = await res.json();
      setContract(updated);
      setContractType(updated.contract_type);
      setEditing(false);

      // Auto-sync linked budget income when rate changes
      if (budgetLinked) {
        const monthlyNet = calcMonthlyNet(updated);
        await fetch("/api/budget/link-contract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: `${updated.client_name} (net)`,
            monthly_amount: monthlyNet,
            work_contract_id: updated.id,
          }),
        });
      }
    }
    setSaving(false);
  }

  async function handleCancel() {
    if (!confirm("Cancel this work contract?")) return;
    const res = await fetch(`/api/work-contracts/${params.id}`, {
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
    if (!confirm("Permanently delete this work contract? This cannot be undone.")) return;
    const res = await fetch(`/api/work-contracts/${params.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      router.push("/work-contracts");
    }
  }

  function calcMonthlyNet(c: WorkContract) {
    let monthlyGross = 0;
    if (c.contract_type === "hourly") {
      monthlyGross = (c.hourly_rate ?? 0) * (c.weekly_hours ?? 0) * 52 / 12;
    } else if (c.contract_type === "retainer") {
      monthlyGross = c.retainer_amount ?? 0;
    } else if (c.contract_type === "fixed_price") {
      monthlyGross = (c.fixed_price ?? 0) / 12;
    }
    return Math.round(monthlyGross * (1 - c.wt_rate) * 100) / 100;
  }

  async function handleLinkToBudget() {
    if (!contract) return;
    const monthlyNet = calcMonthlyNet(contract);

    const res = await fetch("/api/budget/link-contract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: `${contract.client_name} (net)`,
        monthly_amount: monthlyNet,
        work_contract_id: contract.id,
      }),
    });
    if (res.ok) {
      setBudgetLinked(true);
    }
  }

  async function handleUnlinkFromBudget() {
    if (!contract) return;
    const res = await fetch(
      `/api/budget/link-contract?contract_id=${contract.id}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setBudgetLinked(false);
    }
  }

  if (!contract) return <div>Loading...</div>;

  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  const statusLabel = contract.status === "expiring_soon"
    ? "Expiring Soon"
    : contract.status.charAt(0).toUpperCase() + contract.status.slice(1);

  const projection = calculateProjection(contract);

  if (editing) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">Edit Work Contract</h1>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label htmlFor="client_name">Client Name</Label>
                <Input id="client_name" name="client_name" defaultValue={contract.client_name} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contract_type">Contract Type</Label>
                  <select
                    id="contract_type"
                    name="contract_type"
                    value={contractType}
                    onChange={(e) => setContractType(e.target.value)}
                    required
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
                    defaultValue={String(contract.wt_rate)}
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
                    <Input id="hourly_rate" name="hourly_rate" type="number" step="0.01" defaultValue={contract.hourly_rate ?? ""} />
                  </div>
                  <div>
                    <Label htmlFor="weekly_hours">Weekly Hours</Label>
                    <Input id="weekly_hours" name="weekly_hours" type="number" step="0.5" defaultValue={contract.weekly_hours ?? ""} />
                  </div>
                </div>
              )}

              {contractType === "fixed_price" && (
                <div>
                  <Label htmlFor="fixed_price">Fixed Price ($)</Label>
                  <Input id="fixed_price" name="fixed_price" type="number" step="0.01" defaultValue={contract.fixed_price ?? ""} />
                </div>
              )}

              {contractType === "retainer" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="retainer_amount">Monthly Retainer ($)</Label>
                    <Input id="retainer_amount" name="retainer_amount" type="number" step="0.01" defaultValue={contract.retainer_amount ?? ""} />
                  </div>
                  <div>
                    <Label htmlFor="retainer_hours">Included Hours</Label>
                    <Input id="retainer_hours" name="retainer_hours" type="number" step="0.5" defaultValue={contract.retainer_hours ?? ""} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input id="start_date" name="start_date" type="date" defaultValue={contract.start_date} required />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date</Label>
                  <Input id="end_date" name="end_date" type="date" defaultValue={contract.end_date ?? ""} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="project_name">Project Name</Label>
                  <Input id="project_name" name="project_name" defaultValue={contract.project_name ?? ""} placeholder="e.g. Digital Transformation" />
                </div>
                <div>
                  <Label htmlFor="project_code">Project Code</Label>
                  <Input id="project_code" name="project_code" defaultValue={contract.project_code ?? ""} placeholder="e.g. DT-2026-041" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="billing_cycle">Billing Cycle</Label>
                  <select
                    id="billing_cycle"
                    name="billing_cycle"
                    defaultValue={contract.billing_cycle ?? ""}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  >
                    <option value="">Not set</option>
                    <option value="weekly">Weekly</option>
                    <option value="fortnightly">Fortnightly</option>
                    <option value="monthly">Monthly</option>
                    <option value="on_completion">On completion</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="invoice_send_day">Invoice Send Day</Label>
                  <select
                    id="invoice_send_day"
                    name="invoice_send_day"
                    defaultValue={String(contract.invoice_send_day ?? "0")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  >
                    <option value="0">Not set</option>
                    <option value="-1">End of month</option>
                    {Array.from({ length: 28 }, (_, i) => (
                      <option key={i + 1} value={String(i + 1)}>{i + 1}{i === 0 ? "st" : i === 1 ? "nd" : i === 2 ? "rd" : "th"}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="invoice_due_day">Payment Due Day</Label>
                  <select
                    id="invoice_due_day"
                    name="invoice_due_day"
                    defaultValue={String(contract.invoice_due_day ?? "0")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  >
                    <option value="0">Not set</option>
                    <option value="-1">End of month</option>
                    {Array.from({ length: 28 }, (_, i) => (
                      <option key={i + 1} value={String(i + 1)}>{i + 1}{i === 0 ? "st" : i === 1 ? "nd" : i === 2 ? "rd" : "th"}</option>
                    ))}
                  </select>
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
      <div className="space-y-4">
        <Link href="/work-contracts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to contracts
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{contract.client_name}</h1>
            <Badge variant={statusVariant[contract.status] || "default"}>
              {statusLabel}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {contract.status !== "cancelled" && contract.status !== "completed" && (
              <>
                <Button variant="outline" onClick={() => setEditing(true)}>Edit</Button>
                {budgetLinked ? (
                  <Button variant="outline" onClick={handleUnlinkFromBudget}>
                    Linked to Budget
                  </Button>
                ) : (
                  <Button variant="outline" onClick={handleLinkToBudget}>
                    Link to Budget
                  </Button>
                )}
                <Button variant="outline" className="text-amber-600 hover:text-amber-700 border-amber-200 hover:bg-amber-50" onClick={handleCancel}>Cancel Contract</Button>
              </>
            )}
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </div>
        </div>
        <p className="text-muted-foreground capitalize">{contract.contract_type.replace("_", " ")} contract</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rate</CardTitle>
          </CardHeader>
          <CardContent>
            {contract.contract_type === "hourly" && (
              <>
                <p className="text-2xl font-bold">{fmt(contract.hourly_rate ?? 0)}/hr</p>
                <p className="text-xs text-muted-foreground">{contract.weekly_hours ?? 0} hrs/week</p>
              </>
            )}
            {contract.contract_type === "fixed_price" && (
              <p className="text-2xl font-bold">{fmt(contract.fixed_price ?? 0)}</p>
            )}
            {contract.contract_type === "retainer" && (
              <>
                <p className="text-2xl font-bold">{fmt(contract.retainer_amount ?? 0)}/mo</p>
                <p className="text-xs text-muted-foreground">{contract.retainer_hours ?? 0} hrs included</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{contract.start_date}</p>
            <p className="text-xs text-muted-foreground">
              {contract.end_date ? `to ${contract.end_date}` : "Ongoing"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Withholding Tax</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{Math.round(contract.wt_rate * 100)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Earnings breakdown */}
      {contract.contract_type === "hourly" && contract.hourly_rate && contract.weekly_hours && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Earnings Breakdown (Gross)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Daily</p>
                <p className="text-lg font-bold">{fmt(contract.hourly_rate * contract.weekly_hours / 5)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fortnightly</p>
                <p className="text-lg font-bold">{fmt(contract.hourly_rate * contract.weekly_hours * 2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly</p>
                <p className="text-lg font-bold">{fmt(contract.hourly_rate * contract.weekly_hours * 52 / 12)}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t">
              <div>
                <p className="text-xs text-muted-foreground">Daily (net)</p>
                <p className="text-lg font-bold text-green-600">{fmt(contract.hourly_rate * contract.weekly_hours / 5 * (1 - contract.wt_rate))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fortnightly (net)</p>
                <p className="text-lg font-bold text-green-600">{fmt(contract.hourly_rate * contract.weekly_hours * 2 * (1 - contract.wt_rate))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly (net)</p>
                <p className="text-lg font-bold text-green-600">{fmt(contract.hourly_rate * contract.weekly_hours * 52 / 12 * (1 - contract.wt_rate))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {contract.contract_type === "retainer" && contract.retainer_amount && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Earnings Breakdown (Gross)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Fortnightly</p>
                <p className="text-lg font-bold">{fmt(contract.retainer_amount * 12 / 26)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly</p>
                <p className="text-lg font-bold">{fmt(contract.retainer_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Annual</p>
                <p className="text-lg font-bold">{fmt(contract.retainer_amount * 12)}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t">
              <div>
                <p className="text-xs text-muted-foreground">Fortnightly (net)</p>
                <p className="text-lg font-bold text-green-600">{fmt(contract.retainer_amount * 12 / 26 * (1 - contract.wt_rate))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly (net)</p>
                <p className="text-lg font-bold text-green-600">{fmt(contract.retainer_amount * (1 - contract.wt_rate))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Annual (net)</p>
                <p className="text-lg font-bold text-green-600">{fmt(contract.retainer_amount * 12 * (1 - contract.wt_rate))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <EarningsCard
        grossProjected={projection.grossProjected}
        wtAmount={projection.wtAmount}
        netProjected={projection.netProjected}
        wtRate={contract.wt_rate}
      />

      {contract.document_id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Attached Document</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href={`/documents`} className="text-sm text-primary hover:underline">
              View document
            </Link>
          </CardContent>
        </Card>
      )}

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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Recent Time Entries</CardTitle>
          <Link
            href={`/timesheets?work_contract_id=${contract.id}`}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No time entries yet.</p>
          ) : (
            <div className="space-y-2">
              {entries.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{e.date}</span>
                    {e.description && (
                      <span className="text-muted-foreground ml-2">{e.description}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{Math.round(e.duration_minutes / 6) / 10}h</span>
                    <Badge variant={e.status === "draft" ? "outline" : "default"} className="text-xs">
                      {e.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
