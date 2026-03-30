"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Entry = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number;
  description: string | null;
  billable: boolean;
  status: string;
  client_name: string;
  hourly_rate: number | null;
  work_contract_id: string;
};

export function EditEntryForm({
  entry,
  onSaved,
  onCancel,
  onDelete,
}: {
  entry: Entry;
  onSaved: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [startTime, setStartTime] = useState(entry.start_time || "");
  const [endTime, setEndTime] = useState(entry.end_time || "");
  const [autoMinutes, setAutoMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (startTime && endTime) {
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      const diff = (eh * 60 + em) - (sh * 60 + sm);
      setAutoMinutes(diff > 0 ? diff : null);
    } else {
      setAutoMinutes(null);
    }
  }, [startTime, endTime]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const data = {
      date: form.get("date"),
      start_time: form.get("start_time") || null,
      end_time: form.get("end_time") || null,
      duration_minutes: form.get("duration_minutes") ? Number(form.get("duration_minutes")) : null,
      description: form.get("description") || null,
      billable: form.get("billable") === "on",
    };

    const res = await fetch(`/api/timesheets/${entry.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      onSaved();
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this time entry?")) return;
    const res = await fetch(`/api/timesheets/${entry.id}`, { method: "DELETE" });
    if (res.ok) {
      onDelete();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-3 bg-background">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          Edit: {entry.client_name} — {entry.date}
        </h3>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <input type="hidden" name="date" value={entry.date} />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label htmlFor="edit_start_time" className="text-xs">Start</Label>
          <Input
            id="edit_start_time"
            name="start_time"
            type="time"
            className="h-9"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="edit_end_time" className="text-xs">End</Label>
          <Input
            id="edit_end_time"
            name="end_time"
            type="time"
            className="h-9"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="edit_duration" className="text-xs">
            Minutes{autoMinutes !== null && <span className="text-muted-foreground ml-1">= {autoMinutes}</span>}
          </Label>
          <Input
            id="edit_duration"
            name="duration_minutes"
            type="number"
            className="h-9"
            defaultValue={autoMinutes ?? entry.duration_minutes}
            key={autoMinutes}
            readOnly={autoMinutes !== null}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="edit_description" className="text-xs">Description</Label>
        <Input id="edit_description" name="description" className="h-9" defaultValue={entry.description || ""} />
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="billable" defaultChecked={entry.billable} className="h-3.5 w-3.5" />
          Billable
        </label>
        <div className="flex items-center gap-2">
          <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>
            Delete
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </form>
  );
}
