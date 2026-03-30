"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Pref = {
  id: string;
  channel: string;
  enabled: boolean;
  detail_level: string;
  config: Record<string, unknown>;
};

type Props = {
  businessId: string;
  preferences: Pref[];
};

const CHANNELS = [
  { key: "in_app", label: "In-App" },
  { key: "desktop", label: "Desktop Push" },
  { key: "email", label: "Email (SMTP)" },
  { key: "slack", label: "Slack" },
];

export function NotificationPrefsClient({ businessId, preferences }: Props) {
  const [prefs, setPrefs] = useState<Record<string, { enabled: boolean; detail_level: string; config: Record<string, string> }>>(() => {
    const map: Record<string, { enabled: boolean; detail_level: string; config: Record<string, string> }> = {};
    for (const ch of CHANNELS) {
      const existing = preferences.find((p) => p.channel === ch.key);
      map[ch.key] = {
        enabled: existing?.enabled ?? (ch.key === "in_app"),
        detail_level: existing?.detail_level ?? "vague",
        config: (existing?.config as Record<string, string>) ?? {},
      };
    }
    return map;
  });

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function updatePref(channel: string, field: string, value: unknown) {
    setPrefs((prev) => ({
      ...prev,
      [channel]: { ...prev[channel], [field]: value },
    }));
  }

  function updateConfig(channel: string, key: string, value: string) {
    setPrefs((prev) => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        config: { ...prev[channel].config, [key]: value },
      },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, preferences: prefs }),
    });

    const data = await res.json();
    setSaving(false);
    setMessage(data.error ? data.error : "Saved");
  }

  async function handleTest(channel: string) {
    setTesting(channel);
    setMessage("");

    const res = await fetch("/api/notifications/preferences/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, channel }),
    });

    const data = await res.json();
    setTesting(null);
    setMessage(data.error ? `Test failed: ${data.error}` : `Test ${channel} sent!`);
  }

  return (
    <div className="space-y-4">
      {CHANNELS.map((ch) => (
        <Card key={ch.key}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">{ch.label}</CardTitle>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={prefs[ch.key].enabled}
                  onChange={(e) => updatePref(ch.key, "enabled", e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm text-muted-foreground">Enabled</span>
              </div>
            </div>
          </CardHeader>
          {prefs[ch.key].enabled && (
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Detail level</Label>
                <Select
                  value={prefs[ch.key].detail_level}
                  onValueChange={(v) => updatePref(ch.key, "detail_level", v)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vague">Vague (no amounts)</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {ch.key === "email" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>SMTP Host</Label>
                      <Input
                        value={prefs.email.config.smtp_host || ""}
                        onChange={(e) => updateConfig("email", "smtp_host", e.target.value)}
                        placeholder="smtp.office365.com"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Port</Label>
                      <Input
                        value={prefs.email.config.smtp_port || "587"}
                        onChange={(e) => updateConfig("email", "smtp_port", e.target.value)}
                        placeholder="587"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>SMTP Username</Label>
                    <Input
                      value={prefs.email.config.smtp_user || ""}
                      onChange={(e) => updateConfig("email", "smtp_user", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>SMTP Password</Label>
                    <Input
                      type="password"
                      value={prefs.email.config.smtp_pass || ""}
                      onChange={(e) => updateConfig("email", "smtp_pass", e.target.value)}
                      placeholder={prefs.email.config.smtp_pass_set ? "••••••••" : ""}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>From address</Label>
                    <Input
                      value={prefs.email.config.from_address || ""}
                      onChange={(e) => updateConfig("email", "from_address", e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>To address</Label>
                    <Input
                      value={prefs.email.config.to_address || ""}
                      onChange={(e) => updateConfig("email", "to_address", e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTest("email")}
                    disabled={testing === "email"}
                  >
                    {testing === "email" ? "Sending..." : "Send test email"}
                  </Button>
                </div>
              )}

              {ch.key === "slack" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Webhook URL</Label>
                    <Input
                      value={prefs.slack.config.webhook_url || ""}
                      onChange={(e) => updateConfig("slack", "webhook_url", e.target.value)}
                      placeholder="https://hooks.slack.com/services/..."
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTest("slack")}
                    disabled={testing === "slack"}
                  >
                    {testing === "slack" ? "Sending..." : "Send test message"}
                  </Button>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      ))}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Preferences"}
        </Button>
        {message && (
          <span className={`text-sm ${message.includes("fail") ? "text-destructive" : "text-muted-foreground"}`}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
