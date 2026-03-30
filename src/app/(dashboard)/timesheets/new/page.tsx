"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

type ActiveContract = {
  id: string;
  client_name: string;
  contract_type: string;
  hourly_rate: number | null;
  status: string;
};

export default function NewTimesheetEntryPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [contracts, setContracts] = useState<ActiveContract[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [autoMinutes, setAutoMinutes] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/work-contracts")
      .then((r) => r.json())
      .then((data: ActiveContract[]) =>
        setContracts(data.filter((c: { status: string }) => c.status === "active" || c.status === "expiring_soon"))
      );
  }, []);

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
      work_contract_id: form.get("work_contract_id"),
      date: form.get("date"),
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
      router.push("/timesheets");
    }
    setSaving(false);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Log Time</h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="work_contract_id">Work Contract</Label>
              <select
                id="work_contract_id"
                name="work_contract_id"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.client_name} ({c.contract_type === "hourly" && c.hourly_rate ? `$${c.hourly_rate}/hr` : c.contract_type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" defaultValue={today} required />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="start_time">Start Time</Label>
                <Input
                  id="start_time"
                  name="start_time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end_time">End Time</Label>
                <Input
                  id="end_time"
                  name="end_time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="duration_minutes">
                  Duration (min)
                  {autoMinutes !== null && (
                    <span className="text-muted-foreground ml-1">= {autoMinutes}</span>
                  )}
                </Label>
                <Input
                  id="duration_minutes"
                  name="duration_minutes"
                  type="number"
                  value={autoMinutes ?? ""}
                  readOnly={autoMinutes !== null}
                  placeholder="Or enter manually"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" />
            </div>

            <div className="flex items-end gap-2 pb-1">
              <input id="billable" name="billable" type="checkbox" className="h-4 w-4" defaultChecked />
              <Label htmlFor="billable">Billable</Label>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Log Time"}
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
