"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ChangePasswordForm() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    const form = new FormData(e.currentTarget);
    const currentPin = form.get("current_pin") as string;
    const newPin = form.get("new_pin") as string;
    const confirmPin = form.get("confirm_pin") as string;

    if (!/^\d{4}$/.test(newPin)) {
      setError("New PIN must be exactly 4 digits");
      setSaving(false);
      return;
    }

    if (newPin !== confirmPin) {
      setError("New PINs don't match");
      setSaving(false);
      return;
    }

    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPin, newPassword: newPin }),
    });

    const data = await res.json();
    setSaving(false);

    if (data.error) {
      setError(data.error);
    } else {
      setSuccess(true);
      (e.target as HTMLFormElement).reset();
      setTimeout(() => setSuccess(false), 5000);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current_pin">Current PIN</Label>
            <Input
              id="current_pin"
              name="current_pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              className="text-center tracking-[0.5em] text-lg max-w-32"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new_pin">New PIN</Label>
            <Input
              id="new_pin"
              name="new_pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              className="text-center tracking-[0.5em] text-lg max-w-32"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_pin">Confirm new PIN</Label>
            <Input
              id="confirm_pin"
              name="confirm_pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              className="text-center tracking-[0.5em] text-lg max-w-32"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && (
            <p className="text-sm text-green-600">PIN changed successfully.</p>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Changing..." : "Change PIN"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
