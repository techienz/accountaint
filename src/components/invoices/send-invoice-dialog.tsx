"use client";

import { useMemo, useState } from "react";
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
import { Send } from "lucide-react";

type Props = {
  invoiceId: string;
  invoiceNumber: string;
  contactName: string;
  contactEmail: string | null;
  contactCcEmails: string | null;
  isResend: boolean;
  onSent: () => void;
  triggerLabel?: string;
};

type EmailConfigSummary = {
  configured: boolean;
  fromAddress: string | null;
  provider: string | null;
};

export function SendInvoiceDialog({
  invoiceId,
  invoiceNumber,
  contactName,
  contactEmail,
  contactCcEmails,
  isResend,
  onSent,
  triggerLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState(contactEmail ?? "");
  const [cc, setCc] = useState(contactCcEmails ?? "");
  const [overrideTemplate, setOverrideTemplate] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);
  const [emailConfig, setEmailConfig] = useState<EmailConfigSummary | null>(null);

  const pdfUrl = useMemo(() => `/api/invoices/${invoiceId}/pdf`, [invoiceId]);

  function handleOpenChange(next: boolean) {
    if (next) {
      // Reset the form to the prefill defaults each time the dialog opens.
      // Doing this in the open handler (an event) rather than useEffect
      // avoids cascading renders flagged by react-hooks/set-state-in-effect.
      setRecipient(contactEmail ?? "");
      setCc(contactCcEmails ?? "");
      setOverrideTemplate(false);
      setSubject("");
      setBody("");
      setMessage(null);
      setMessageType(null);

      fetch("/api/email-config-summary")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => setEmailConfig(data))
        .catch(() => setEmailConfig(null));
    }
    setOpen(next);
  }

  async function handleSend() {
    setSending(true);
    setMessage(null);
    setMessageType(null);

    const ccList = cc
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: recipient.trim() || undefined,
          cc_emails: ccList,
          subject: overrideTemplate && subject.trim() ? subject : undefined,
          body: overrideTemplate && body.trim() ? body : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.email_error || "Send failed");
      if (data.email_error) throw new Error(data.email_error);

      setMessage(`Sent ${invoiceNumber} to ${data.emailed_to}.`);
      setMessageType("success");
      onSent();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Send failed");
      setMessageType("error");
    } finally {
      setSending(false);
    }
  }

  const buttonLabel = triggerLabel ?? (isResend ? "Resend" : "Send");
  const sendingLabel = isResend ? "Resending..." : "Sending...";
  const sendButtonLabel = isResend ? "Resend invoice" : "Send invoice";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button variant={isResend ? "outline" : "default"} />}
      >
        <Send className="mr-2 h-4 w-4" />
        {buttonLabel}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isResend ? "Resend" : "Send"} {invoiceNumber}
          </DialogTitle>
          <DialogDescription>
            {isResend
              ? `Resend the PDF to ${contactName}. Status will not change.`
              : `Email the PDF invoice to ${contactName}. Marks the invoice as sent.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {emailConfig && !emailConfig.configured && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/60 p-3 text-xs">
              Email is not yet configured. Open{" "}
              <a className="underline" href="/settings/notifications">
                Settings → Notifications → Email
              </a>{" "}
              to set up SMTP or Microsoft Graph before sending.
            </div>
          )}
          {emailConfig?.configured && emailConfig.fromAddress && (
            <p className="text-xs text-muted-foreground">
              Sending from <span className="font-medium">{emailConfig.fromAddress}</span>
              {emailConfig.provider ? ` via ${emailConfig.provider}` : ""}.
            </p>
          )}

          <div>
            <Label htmlFor="invoice-send-to">To</Label>
            <Input
              id="invoice-send-to"
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="name@example.com"
            />
            {!contactEmail && (
              <p className="text-xs text-muted-foreground mt-1">
                The contact has no saved email. Add one to {contactName} to skip
                this step next time.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="invoice-send-cc">CC (comma-separated, optional)</Label>
            <Input
              id="invoice-send-cc"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="another@example.com, team@example.com"
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
                <Label htmlFor="invoice-send-subject">Subject</Label>
                <Input
                  id="invoice-send-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Leave blank to use template"
                />
              </div>
              <div>
                <Label htmlFor="invoice-send-body">Body (HTML)</Label>
                <textarea
                  id="invoice-send-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  placeholder="Leave blank to use template"
                  className="flex min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </>
          )}

          <div className="rounded-md border border-border/50 bg-muted/20 p-3 text-xs space-y-1">
            <p className="font-medium">Preview</p>
            <p>
              <span className="text-muted-foreground">To:</span>{" "}
              {recipient.trim() || (
                <span className="text-amber-600 dark:text-amber-400">
                  (blank — add a recipient)
                </span>
              )}
            </p>
            {cc.trim() && (
              <p>
                <span className="text-muted-foreground">CC:</span> {cc}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Attachment:</span>{" "}
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {invoiceNumber}.pdf (open preview)
              </a>
            </p>
          </div>

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
            <Button
              onClick={handleSend}
              disabled={sending || !recipient.trim() || (emailConfig ? !emailConfig.configured : false)}
            >
              {sending ? sendingLabel : sendButtonLabel}
            </Button>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
