"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  claimId: string;
  onSuccess: () => void;
};

export function LogbookForm({ claimId, onSuccess }: Props) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [km, setKm] = useState("");
  const [purpose, setPurpose] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const res = await fetch("/api/calculators/vehicle/logbook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicle_claim_id: claimId,
        date,
        from_location: from,
        to_location: to,
        km: Number(km),
        purpose: purpose || null,
        is_business: true,
      }),
    });

    if (res.ok) {
      setFrom("");
      setTo("");
      setKm("");
      setPurpose("");
      onSuccess();
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border p-4">
      <h4 className="text-sm font-medium">Add Trip</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <Label>Kilometres</Label>
          <Input type="number" step="0.1" value={km} onChange={(e) => setKm(e.target.value)} required />
        </div>
        <div>
          <Label>From</Label>
          <Input value={from} onChange={(e) => setFrom(e.target.value)} required />
        </div>
        <div>
          <Label>To</Label>
          <Input value={to} onChange={(e) => setTo(e.target.value)} required />
        </div>
      </div>
      <div>
        <Label>Purpose</Label>
        <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Client meeting" />
      </div>
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Saving..." : "Add Trip"}
      </Button>
    </form>
  );
}
