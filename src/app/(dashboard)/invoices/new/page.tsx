"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { LineItemRow } from "@/components/invoices/line-item-row";
import { InvoiceTotals } from "@/components/invoices/invoice-totals";
import { Plus } from "lucide-react";

type Contact = {
  id: string;
  name: string;
  type: string;
  default_due_days: number;
};

type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  gst_rate: number;
};

const emptyLine: LineItem = { description: "", quantity: 1, unit_price: 0, gst_rate: 0.15 };

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");
  const editId = searchParams.get("edit");
  const [type, setType] = useState<"ACCREC" | "ACCPAY">(
    typeParam === "ACCPAY" ? "ACCPAY" : "ACCREC"
  );
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [gstInclusive, setGstInclusive] = useState(false);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...emptyLine }]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!editId);

  useEffect(() => {
    fetch("/api/contacts")
      .then((r) => r.json())
      .then(setContacts);
  }, []);

  // Load existing invoice for editing
  useEffect(() => {
    if (!editId) return;
    fetch(`/api/invoices/${editId}`)
      .then((r) => r.json())
      .then((inv) => {
        if (inv.error) return;
        setType(inv.type);
        setContactId(inv.contact_id);
        setDate(inv.date);
        setDueDate(inv.due_date);
        setGstInclusive(inv.gst_inclusive);
        setReference(inv.reference || "");
        setNotes(inv.notes || "");
        setPaymentInstructions(inv.payment_instructions || "");
        if (inv.line_items && inv.line_items.length > 0) {
          setLineItems(
            inv.line_items.map((li: { description: string; quantity: number; unit_price: number; gst_rate: number }) => ({
              description: li.description,
              quantity: li.quantity,
              unit_price: li.unit_price,
              gst_rate: li.gst_rate,
            }))
          );
        }
        setLoaded(true);
      });
  }, [editId]);

  // Auto-calculate due date from contact's default_due_days (only for new invoices)
  useEffect(() => {
    if (editId) return; // Don't auto-set due date when editing
    if (contactId && date) {
      const contact = contacts.find((c) => c.id === contactId);
      if (contact) {
        const d = new Date(date);
        d.setDate(d.getDate() + contact.default_due_days);
        setDueDate(d.toISOString().slice(0, 10));
      }
    }
  }, [contactId, date, contacts, editId]);

  const filteredContacts = contacts.filter((c) => {
    if (type === "ACCREC") return c.type === "customer" || c.type === "both";
    return c.type === "supplier" || c.type === "both";
  });

  function updateLineItem(index: number, item: LineItem) {
    setLineItems((prev) => prev.map((li, i) => (i === index ? item : li)));
  }

  function removeLineItem(index: number) {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(action: "draft" | "send") {
    if (!contactId || !date || !dueDate) return;
    const validItems = lineItems.filter((li) => li.description && li.unit_price > 0);
    if (validItems.length === 0) return;

    setSaving(true);

    const body = {
      contact_id: contactId,
      type,
      date,
      due_date: dueDate,
      gst_inclusive: gstInclusive,
      reference: reference || null,
      notes: notes || null,
      payment_instructions: paymentInstructions || null,
      line_items: validItems,
    };

    let invoiceId = editId;

    if (editId) {
      // Update existing invoice
      const res = await fetch(`/api/invoices/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setSaving(false); return; }
    } else {
      // Create new invoice
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setSaving(false); return; }
      const invoice = await res.json();
      invoiceId = invoice.id;
    }

    if (action === "send" && invoiceId) {
      await fetch(`/api/invoices/${invoiceId}/send`, { method: "POST" });
    }

    router.push("/invoices");
    setSaving(false);
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold">Loading invoice...</h1>
      </div>
    );
  }

  const isInvoice = type === "ACCREC";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">
        {editId ? "Edit" : "New"} {isInvoice ? "Invoice" : "Bill"}
      </h1>

      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Type + Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "ACCREC" | "ACCPAY")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                disabled={!!editId}
              >
                <option value="ACCREC">Invoice (Sales)</option>
                <option value="ACCPAY">Bill (Purchase)</option>
              </select>
            </div>
            <div>
              <Label>Contact</Label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="">Select contact...</option>
                {filteredContacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label>Reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="PO number etc" />
            </div>
          </div>

          {/* GST toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="gst_inclusive"
              checked={gstInclusive}
              onChange={(e) => setGstInclusive(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="gst_inclusive" className="font-normal">
              Amounts are GST inclusive
            </Label>
          </div>

          {/* Line items */}
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium">
              <div className="col-span-5">Description</div>
              <div className="col-span-2">Qty</div>
              <div className="col-span-2">Unit Price</div>
              <div className="col-span-1">GST</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-1" />
            </div>
            {lineItems.map((item, i) => (
              <LineItemRow
                key={i}
                item={item}
                gstInclusive={gstInclusive}
                onChange={(updated) => updateLineItem(i, updated)}
                onRemove={() => removeLineItem(i)}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLineItems((prev) => [...prev, { ...emptyLine }])}
            >
              <Plus className="mr-2 h-4 w-4" />Add Line
            </Button>
          </div>

          {/* Totals */}
          <InvoiceTotals lineItems={lineItems} gstInclusive={gstInclusive} />

          {/* Notes / Payment Instructions */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Notes</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div>
              <Label>Payment Instructions</Label>
              <Textarea rows={3} value={paymentInstructions} onChange={(e) => setPaymentInstructions(e.target.value)} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={() => handleSubmit("draft")} disabled={saving}>
              {saving ? "Saving..." : editId ? "Save Changes" : "Save Draft"}
            </Button>
            {!editId && (
              <Button variant="outline" onClick={() => handleSubmit("send")} disabled={saving}>
                Save & Send
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
