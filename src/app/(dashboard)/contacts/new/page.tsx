"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const contactTypes = [
  { value: "customer", label: "Customer" },
  { value: "supplier", label: "Supplier" },
  { value: "both", label: "Both" },
];

export default function NewContactPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get("name"),
      email: form.get("email") || null,
      phone: form.get("phone") || null,
      address: form.get("address") || null,
      tax_number: form.get("tax_number") || null,
      type: form.get("type"),
      default_due_days: Number(form.get("default_due_days")) || 20,
      notes: form.get("notes") || null,
    };

    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      router.push("/contacts");
    }
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Add Contact</h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" name="address" rows={2} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  name="type"
                  defaultValue="customer"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  {contactTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="default_due_days">Default Due Days</Label>
                <Input id="default_due_days" name="default_due_days" type="number" defaultValue={20} />
              </div>
              <div>
                <Label htmlFor="tax_number">IRD / NZBN</Label>
                <Input id="tax_number" name="tax_number" />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Add Contact"}
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
