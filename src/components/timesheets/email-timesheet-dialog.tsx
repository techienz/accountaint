"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail } from "lucide-react";

type Contract = {
  id: string;
  client_name: string;
  contact_id?: string | null;
};

type Props = {
  contracts: Contract[];
  defaultContractId?: string;
  defaultDateFrom?: string;
  defaultDateTo?: string;
};

type ContactSummary = {
  id: string;
  name: string;
  email: string | null;
};

type ContactOption = {
  id: string;
  name: string;
  email: string | null;
};

export function EmailTimesheetDialog({
  contracts,
  defaultContractId,
  defaultDateFrom,
  defaultDateTo,
}: Props) {
  const [open, setOpen] = useState(false);
  const [contractId, setContractId] = useState(defaultContractId ?? contracts[0]?.id ?? "");
  const [dateFrom, setDateFrom] = useState(defaultDateFrom ?? "");
  const [dateTo, setDateTo] = useState(defaultDateTo ?? "");
  const [recipient, setRecipient] = useState("");
  const [cc, setCc] = useState("");
  const [formatPdf, setFormatPdf] = useState(true);
  const [formatXlsx, setFormatXlsx] = useState(false);
  const [formatCsv, setFormatCsv] = useState(false);
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [overrideTemplate, setOverrideTemplate] = useState(false);
  const [contactEmail, setContactEmail] = useState<string | null>(null);
  const [allContacts, setAllContacts] = useState<ContactOption[]>([]);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);

  // When dialog opens, load all contacts for the picker
  useEffect(() => {
    if (!open) return;
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((data: ContactOption[]) =>
        setAllContacts(data.filter((c) => c.email))
      )
      .catch(() => setAllContacts([]));
  }, [open]);

  // When contract changes, look up the linked contact email so the "Use contact email" button can prefill.
  useEffect(() => {
    if (!open || !contractId) return;
    const contract = contracts.find((c) => c.id === contractId);
    if (!contract?.contact_id) {
      setContactEmail(null);
      return;
    }
    fetch(`/api/contacts/${contract.contact_id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c: ContactSummary | null) => setContactEmail(c?.email ?? null))
      .catch(() => setContactEmail(null));
  }, [open, contractId, contracts]);

  function applyContactEmail() {
    if (contactEmail) setRecipient(contactEmail);
  }

  function pickContact(contactId: string) {
    if (!contactId) return;
    const c = allContacts.find((x) => x.id === contactId);
    if (c?.email) setRecipient(c.email);
  }

  function reset() {
    setOpen(false);
    setMessage(null);
    setMessageType(null);
    setRecipient("");
    setCc("");
    setSubject("");
    setBody("");
    setOverrideTemplate(false);
  }

  async function handleSend() {
    setSending(true);
    setMessage(null);
    setMessageType(null);

    const formats: string[] = [];
    if (formatPdf) formats.push("pdf");
    if (formatXlsx) formats.push("xlsx");
    if (formatCsv) formats.push("csv");

    if (formats.length === 0) {
      setMessage("Select at least one attachment format.");
      setMessageType("error");
      setSending(false);
      return;
    }

    try {
      const res = await fetch("/api/timesheets/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_id: contractId,
          date_from: dateFrom,
          date_to: dateTo,
          recipient: recipient.trim(),
          cc_emails:
            cc.trim() !== ""
              ? cc.split(",").map((e) => e.trim()).filter(Boolean)
              : undefined,
          formats,
          include_drafts: includeDrafts,
          subject: overrideTemplate && subject.trim() !== "" ? subject : undefined,
          body: overrideTemplate && body.trim() !== "" ? body : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");

      setMessage(
        `Sent ${data.entryCount} entr${data.entryCount === 1 ? "y" : "ies"} (${data.totalHours.toFixed(2)} hrs, $${data.totalAmount.toLocaleString("en-NZ", { minimumFractionDigits: 2 })}) to ${recipient}.`
      );
      setMessageType("success");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Send failed");
      setMessageType("error");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : reset())}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Mail className="mr-1 h-3.5 w-3.5" />
        Email
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Email Timesheet</DialogTitle>
          <DialogDescription>
            Send timesheet attachments to a recipient. Uses your configured
            email (Settings → Notifications → Email).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Contract</Label>
            <Select value={contractId} onValueChange={(v) => v && setContractId(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contracts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.client_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="email-ts-from">From</Label>
              <Input
                id="email-ts-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="email-ts-to">To</Label>
              <Input
                id="email-ts-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="email-ts-recipient">Recipient</Label>
              {contactEmail && (
                <button
                  type="button"
                  onClick={applyContactEmail}
                  className="text-xs text-primary hover:underline"
                >
                  Use linked contact ({contactEmail})
                </button>
              )}
            </div>
            <Input
              id="email-ts-recipient"
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="name@example.com"
            />
            {allContacts.length > 0 && (
              <div className="mt-2">
                <Label className="text-xs text-muted-foreground">
                  Or pick from your contacts:
                </Label>
                <select
                  value=""
                  onChange={(e) => {
                    pickContact(e.target.value);
                    e.target.value = "";
                  }}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">— Select a contact —</option>
                  {allContacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="email-ts-cc">CC (comma-separated, optional)</Label>
            <Input
              id="email-ts-cc"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="another@example.com, team@example.com"
            />
          </div>

          <div>
            <Label>Attachments</Label>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formatPdf}
                  onChange={(e) => setFormatPdf(e.target.checked)}
                />
                PDF
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formatXlsx}
                  onChange={(e) => setFormatXlsx(e.target.checked)}
                />
                Excel
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formatCsv}
                  onChange={(e) => setFormatCsv(e.target.checked)}
                />
                CSV
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="email-ts-drafts" className="flex flex-col gap-0.5">
              <span>Include draft entries</span>
              <span className="text-xs text-muted-foreground font-normal">
                Default: approved + invoiced only
              </span>
            </Label>
            <Switch
              id="email-ts-drafts"
              checked={includeDrafts}
              onCheckedChange={setIncludeDrafts}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="flex flex-col gap-0.5">
              <span>Override template</span>
              <span className="text-xs text-muted-foreground font-normal">
                Use a custom subject / body just for this send
              </span>
            </Label>
            <Switch checked={overrideTemplate} onCheckedChange={setOverrideTemplate} />
          </div>

          {overrideTemplate && (
            <>
              <div>
                <Label htmlFor="email-ts-subject">Subject</Label>
                <Input
                  id="email-ts-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Leave blank to use template"
                />
              </div>
              <div>
                <Label htmlFor="email-ts-body">Body (HTML)</Label>
                <textarea
                  id="email-ts-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  placeholder="Leave blank to use template"
                  className="flex min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </>
          )}

          {message && (
            <p
              className={`text-sm ${
                messageType === "success"
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {message}
            </p>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSend} disabled={sending}>
              {sending ? "Sending..." : "Send email"}
            </Button>
            <Button variant="outline" onClick={reset}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
