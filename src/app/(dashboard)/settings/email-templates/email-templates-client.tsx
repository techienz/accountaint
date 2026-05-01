"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { renderTemplate } from "@/lib/email-templates/render";

type TemplateKind = "invoice" | "invoice_reminder" | "timesheet" | "payslip";

type Template = {
  kind: TemplateKind;
  label: string;
  description: string;
  subject: string;
  body: string;
  is_default: boolean;
  placeholders: Array<{ key: string; description: string }>;
  sampleData: Record<string, string>;
  defaultSubject: string;
  defaultBody: string;
};

export function EmailTemplatesClient({ initial }: { initial: Template[] }) {
  const [templates, setTemplates] = useState(initial);
  const [editing, setEditing] = useState<Record<TemplateKind, { subject: string; body: string } | null>>({
    invoice: null,
    invoice_reminder: null,
    timesheet: null,
    payslip: null,
  });
  const [preview, setPreview] = useState<Record<TemplateKind, boolean>>({
    invoice: false,
    invoice_reminder: false,
    timesheet: false,
    payslip: false,
  });
  const [saving, setSaving] = useState<TemplateKind | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function startEditing(t: Template) {
    setEditing((prev) => ({
      ...prev,
      [t.kind]: { subject: t.subject, body: t.body },
    }));
  }

  function cancelEditing(kind: TemplateKind) {
    setEditing((prev) => ({ ...prev, [kind]: null }));
  }

  function updateEdit(kind: TemplateKind, field: "subject" | "body", value: string) {
    setEditing((prev) => {
      const current = prev[kind];
      if (!current) return prev;
      return { ...prev, [kind]: { ...current, [field]: value } };
    });
  }

  async function handleSave(kind: TemplateKind) {
    const edit = editing[kind];
    if (!edit) return;
    setSaving(kind);
    setMessage(null);
    try {
      const res = await fetch(`/api/email-templates/${kind}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edit),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Save failed");
      }
      setTemplates((prev) =>
        prev.map((t) =>
          t.kind === kind
            ? { ...t, subject: edit.subject, body: edit.body, is_default: false }
            : t
        )
      );
      setEditing((prev) => ({ ...prev, [kind]: null }));
      setMessage(`Saved ${kind} template.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  }

  async function handleReset(kind: TemplateKind) {
    if (!confirm(`Reset the ${kind} template to default?`)) return;
    setSaving(kind);
    setMessage(null);
    try {
      const res = await fetch(`/api/email-templates/${kind}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Reset failed");
      }
      setTemplates((prev) =>
        prev.map((t) =>
          t.kind === kind
            ? {
                ...t,
                subject: t.defaultSubject,
                body: t.defaultBody,
                is_default: true,
              }
            : t
        )
      );
      setEditing((prev) => ({ ...prev, [kind]: null }));
      setMessage(`Reset ${kind} template to default.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Email Templates</h1>
        <p className="text-sm text-muted-foreground">
          Customise the default subject and body for each email the app sends
          on your behalf. You can still override these per-send.
        </p>
      </div>

      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}

      {templates.map((t) => {
        const edit = editing[t.kind];
        const isEditing = edit !== null;
        const displaySubject = isEditing ? edit!.subject : t.subject;
        const displayBody = isEditing ? edit!.body : t.body;
        const showPreview = preview[t.kind];

        const previewSubject = renderTemplate(displaySubject, t.sampleData);
        const previewBody = renderTemplate(displayBody, t.sampleData);
        const previewDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#1a1a1a;font-size:14px;padding:12px;margin:0;}</style></head><body>${previewBody}</body></html>`;

        return (
          <Card key={t.kind}>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {t.label}
                    {t.is_default ? (
                      <Badge variant="secondary">Default</Badge>
                    ) : (
                      <Badge>Custom</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{t.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEditing(t)}
                    >
                      Edit
                    </Button>
                  )}
                  {!t.is_default && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReset(t.kind)}
                      disabled={saving === t.kind}
                    >
                      Reset to default
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor={`subject-${t.kind}`}>Subject</Label>
                <Input
                  id={`subject-${t.kind}`}
                  value={displaySubject}
                  onChange={(e) => updateEdit(t.kind, "subject", e.target.value)}
                  disabled={!isEditing}
                />
              </div>
              <div>
                <Label htmlFor={`body-${t.kind}`}>Body (HTML)</Label>
                <textarea
                  id={`body-${t.kind}`}
                  value={displayBody}
                  onChange={(e) => updateEdit(t.kind, "body", e.target.value)}
                  disabled={!isEditing}
                  rows={10}
                  className="flex min-h-[180px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>

              {isEditing && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleSave(t.kind)}
                    disabled={saving === t.kind}
                  >
                    {saving === t.kind ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => cancelEditing(t.kind)}
                  >
                    Cancel
                  </Button>
                </div>
              )}

              <div className="rounded-md border border-border/50 bg-muted/20 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Available placeholders
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setPreview((prev) => ({
                        ...prev,
                        [t.kind]: !prev[t.kind],
                      }))
                    }
                  >
                    {showPreview ? "Hide preview" : "Show preview"}
                  </Button>
                </div>
                <div className="grid gap-1 text-xs sm:grid-cols-2">
                  {t.placeholders.map((p) => (
                    <div key={p.key} className="font-mono">
                      <code className="text-primary">{`{{${p.key}}}`}</code>{" "}
                      <span className="text-muted-foreground font-sans">
                        — {p.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {showPreview && (
                <div className="rounded-md border border-border/50 p-3 space-y-2 bg-white dark:bg-neutral-50">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Preview with sample data
                  </p>
                  <p className="text-sm font-semibold text-neutral-900">
                    Subject: {previewSubject}
                  </p>
                  <iframe
                    sandbox=""
                    srcDoc={previewDoc}
                    className="w-full min-h-[220px] border border-border/50 rounded bg-white"
                    title={`${t.kind} preview`}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
