"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Pause, Play } from "lucide-react";
import { LineItemRow } from "@/components/invoices/line-item-row";
import { InvoiceTotals } from "@/components/invoices/invoice-totals";

type Frequency = "weekly" | "fortnightly" | "monthly" | "quarterly";

type Line = { description: string; quantity: number; unit_price: number; gst_rate: number };

type Schedule = {
  id: string;
  contact_id: string;
  name: string;
  frequency: Frequency;
  next_run_date: string;
  end_date: string | null;
  due_days: number;
  gst_inclusive: boolean;
  reference_template: string | null;
  notes: string | null;
  payment_instructions: string | null;
  auto_send: boolean;
  active: boolean;
  last_generated_at: string | null;
  last_generated_invoice_id: string | null;
  lines: Array<Line & { id: string; sort_order: number; account_code: string | null }>;
};

type Contact = {
  id: string;
  name: string;
  type: string;
};

const FREQ_LABELS: Record<Frequency, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

const fmt = (n: number) => "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

function totalsFor(lines: Line[], gstInclusive: boolean) {
  let subtotal = 0;
  let gstTotal = 0;
  for (const item of lines) {
    if (gstInclusive) {
      const lineTotal = (item.quantity * item.unit_price) / (1 + item.gst_rate);
      subtotal += lineTotal;
      gstTotal += item.quantity * item.unit_price - lineTotal;
    } else {
      const lineTotal = item.quantity * item.unit_price;
      subtotal += lineTotal;
      gstTotal += lineTotal * item.gst_rate;
    }
  }
  return { subtotal, gstTotal, total: subtotal + gstTotal };
}

const emptyLine: Line = { description: "", quantity: 1, unit_price: 0, gst_rate: 0.15 };

const todayIso = () => new Date().toISOString().slice(0, 10);

type FormState = {
  id: string | null;
  contact_id: string;
  name: string;
  frequency: Frequency;
  next_run_date: string;
  end_date: string;
  due_days: number;
  gst_inclusive: boolean;
  reference_template: string;
  notes: string;
  payment_instructions: string;
  auto_send: boolean;
  active: boolean;
  lines: Line[];
};

const blankForm: FormState = {
  id: null,
  contact_id: "",
  name: "",
  frequency: "monthly",
  next_run_date: todayIso(),
  end_date: "",
  due_days: 20,
  gst_inclusive: false,
  reference_template: "",
  notes: "",
  payment_instructions: "",
  auto_send: false,
  active: true,
  lines: [{ ...emptyLine }],
};

export default function RecurringInvoicesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/invoices/recurring").then((r) => r.json()).then(setSchedules);
  }

  useEffect(() => {
    load();
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((cs: Contact[]) =>
        setContacts(cs.filter((c) => c.type === "customer" || c.type === "both")),
      );
  }, []);

  function startCreate() {
    setForm({ ...blankForm, lines: [{ ...emptyLine }] });
    setError(null);
  }

  function startEdit(s: Schedule) {
    setForm({
      id: s.id,
      contact_id: s.contact_id,
      name: s.name,
      frequency: s.frequency,
      next_run_date: s.next_run_date,
      end_date: s.end_date ?? "",
      due_days: s.due_days,
      gst_inclusive: s.gst_inclusive,
      reference_template: s.reference_template ?? "",
      notes: s.notes ?? "",
      payment_instructions: s.payment_instructions ?? "",
      auto_send: s.auto_send,
      active: s.active,
      lines: s.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        gst_rate: l.gst_rate,
      })),
    });
    setError(null);
  }

  function cancelForm() {
    setForm(null);
    setError(null);
  }

  async function save() {
    if (!form) return;
    if (!form.contact_id) return setError("Pick a contact.");
    if (!form.name.trim()) return setError("Give the schedule a name.");
    if (form.lines.length === 0 || form.lines.some((l) => !l.description.trim())) {
      return setError("Every line needs a description.");
    }

    setSaving(true);
    setError(null);
    try {
      const url = form.id ? `/api/invoices/recurring/${form.id}` : "/api/invoices/recurring";
      const method = form.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          end_date: form.end_date.trim() || null,
          reference_template: form.reference_template.trim() || null,
          notes: form.notes.trim() || null,
          payment_instructions: form.payment_instructions.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save schedule");
      setForm(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save schedule");
    } finally {
      setSaving(false);
    }
  }

  async function togglePause(s: Schedule) {
    await fetch(`/api/invoices/recurring/${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !s.active }),
    });
    load();
  }

  async function remove(s: Schedule) {
    if (!confirm(`Delete recurring schedule "${s.name}"? Generated invoices keep history; the schedule stops generating new ones.`)) return;
    await fetch(`/api/invoices/recurring/${s.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recurring invoices</h1>
          <p className="text-muted-foreground">
            Automatically generate draft invoices on a schedule. Drafts are
            created locally; auto-send is opt-in per schedule.
          </p>
        </div>
        {!form && (
          <Button onClick={startCreate}>
            <Plus className="mr-2 h-4 w-4" />New schedule
          </Button>
        )}
      </div>

      {form && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-lg font-semibold">
              {form.id ? "Edit schedule" : "New recurring schedule"}
            </h2>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Contact</Label>
                <select
                  value={form.contact_id}
                  onChange={(e) => setForm({ ...form, contact_id: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">— Select a contact —</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Schedule name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Acme monthly retainer"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <Label>Frequency</Label>
                <select
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value as Frequency })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {(Object.keys(FREQ_LABELS) as Frequency[]).map((f) => (
                    <option key={f} value={f}>{FREQ_LABELS[f]}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Next run date</Label>
                <Input
                  type="date"
                  value={form.next_run_date}
                  onChange={(e) => setForm({ ...form, next_run_date: e.target.value })}
                />
              </div>
              <div>
                <Label>End date (optional)</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Due days</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.due_days}
                  onChange={(e) => setForm({ ...form, due_days: Number(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div>
              <Label>Reference template (optional)</Label>
              <Input
                value={form.reference_template}
                onChange={(e) => setForm({ ...form, reference_template: e.target.value })}
                placeholder='e.g. "Retainer {{period}}" — {{period}} expands to the invoice date'
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line items</Label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={form.gst_inclusive}
                    onChange={(e) => setForm({ ...form, gst_inclusive: e.target.checked })}
                    className="rounded"
                  />
                  Prices include GST
                </label>
              </div>
              <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground px-1">
                <div className="col-span-5">Description</div>
                <div className="col-span-2">Qty</div>
                <div className="col-span-2">Unit price</div>
                <div className="col-span-1">GST</div>
                <div className="col-span-1 text-right">Total</div>
                <div className="col-span-1" />
              </div>
              {form.lines.map((line, idx) => (
                <LineItemRow
                  key={idx}
                  item={line}
                  gstInclusive={form.gst_inclusive}
                  onChange={(updated) => {
                    const copy = form.lines.slice();
                    copy[idx] = updated;
                    setForm({ ...form, lines: copy });
                  }}
                  onRemove={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) })}
                />
              ))}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setForm({ ...form, lines: [...form.lines, { ...emptyLine }] })}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />Add line
                </Button>
                <InvoiceTotals lineItems={form.lines} gstInclusive={form.gst_inclusive} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.auto_send}
                  onCheckedChange={(v) => setForm({ ...form, auto_send: v })}
                />
                <div>
                  <p className="text-sm font-medium">Auto-send each invoice</p>
                  <p className="text-xs text-muted-foreground">
                    If off (default), drafts are created and you review before sending.
                  </p>
                </div>
              </div>
              {form.id && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.active}
                    onCheckedChange={(v) => setForm({ ...form, active: v })}
                  />
                  <span className="text-sm">Active</span>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving..." : form.id ? "Save changes" : "Create schedule"}
              </Button>
              <Button variant="outline" onClick={cancelForm} disabled={saving}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4">
          {schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No recurring schedules yet. Create one to automate regular invoices.
            </p>
          ) : (
            <div className="space-y-2">
              {schedules.map((s) => {
                const t = totalsFor(s.lines, s.gst_inclusive);
                const contactName = contacts.find((c) => c.id === s.contact_id)?.name ?? "(deleted contact)";
                return (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 border rounded-lg"
                  >
                    <div className="flex-1 min-w-[260px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{s.name}</p>
                        <Badge variant={s.active ? "default" : "secondary"}>
                          {s.active ? "Active" : "Paused"}
                        </Badge>
                        {s.auto_send && <Badge variant="outline">Auto-send</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {contactName} · {FREQ_LABELS[s.frequency]} · next {s.next_run_date}
                        {s.end_date ? ` · ends ${s.end_date}` : ""}
                      </p>
                      {s.last_generated_invoice_id && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Last generated:{" "}
                          <Link
                            className="underline"
                            href={`/invoices/${s.last_generated_invoice_id}`}
                          >
                            view invoice
                          </Link>
                        </p>
                      )}
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold">{fmt(t.total)}</p>
                      <p className="text-muted-foreground text-xs">{s.lines.length} line item{s.lines.length === 1 ? "" : "s"}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => togglePause(s)}>
                        {s.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => startEdit(s)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(s)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
