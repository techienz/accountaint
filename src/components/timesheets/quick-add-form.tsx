"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ActiveContract = {
  id: string;
  client_name: string;
};

export function QuickAddForm({
  date,
  contracts,
  onSaved,
  onCancel,
}: {
  date: string;
  contracts: ActiveContract[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const data = {
      work_contract_id: form.get("work_contract_id"),
      date,
      start_time: form.get("start_time") || null,
      end_time: form.get("end_time") || null,
      duration_minutes: form.get("duration_minutes") ? Number(form.get("duration_minutes")) : null,
      description: form.get("description") || null,
      billable: form.get("billable") === "on",
    };

    const res = await fetch("/api/timesheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      onSaved();
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-3 bg-background">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Log time for {date}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <div>
        <Label htmlFor="work_contract_id" className="text-xs">Contract</Label>
        <select
          id="work_contract_id"
          name="work_contract_id"
          required
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background"
        >
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>{c.client_name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label htmlFor="start_time" className="text-xs">Start</Label>
          <Input id="start_time" name="start_time" type="time" className="h-9" />
        </div>
        <div>
          <Label htmlFor="end_time" className="text-xs">End</Label>
          <Input id="end_time" name="end_time" type="time" className="h-9" />
        </div>
        <div>
          <Label htmlFor="duration_minutes" className="text-xs">Minutes</Label>
          <Input id="duration_minutes" name="duration_minutes" type="number" className="h-9" placeholder="Or manual" />
        </div>
      </div>
      <div>
        <Label htmlFor="description" className="text-xs">Description</Label>
        <Input id="description" name="description" className="h-9" />
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="billable" defaultChecked className="h-3.5 w-3.5" />
          Billable
        </label>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving..." : "Add"}
        </Button>
      </div>
    </form>
  );
}
