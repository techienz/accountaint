"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IrdNumberInput } from "@/components/ird-number-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export default function NewShareholderPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [irdNumber, setIrdNumber] = useState("");
  const [ownershipPercentage, setOwnershipPercentage] = useState("");
  const [isDirector, setIsDirector] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const res = await fetch("/api/shareholders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        ird_number: irdNumber || null,
        ownership_percentage: Number(ownershipPercentage),
        is_director: isDirector,
      }),
    });

    if (res.ok) {
      router.push("/shareholders");
    }
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Add Shareholder</h1>
      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="ird">IRD Number</Label>
              <IrdNumberInput
                id="ird"
                value={irdNumber}
                onChange={setIrdNumber}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="ownership">Ownership Percentage (%)</Label>
              <Input
                id="ownership"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={ownershipPercentage}
                onChange={(e) => setOwnershipPercentage(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="director"
                checked={isDirector}
                onCheckedChange={setIsDirector}
              />
              <Label htmlFor="director">Is a director</Label>
            </div>
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Saving..." : "Add Shareholder"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
