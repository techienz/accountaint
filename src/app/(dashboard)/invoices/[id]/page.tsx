"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Send, Ban } from "lucide-react";

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  gst_rate: number;
  line_total: number;
  gst_amount: number;
  work_contract_id: string | null;
};

type Invoice = {
  id: string;
  invoice_number: string;
  type: string;
  status: string;
  date: string;
  due_date: string;
  reference: string | null;
  subtotal: number;
  gst_total: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  gst_inclusive: boolean;
  notes: string | null;
  payment_instructions: string | null;
  contact_name: string;
  contact_id: string;
  line_items: LineItem[];
};

type Payment = {
  id: string;
  date: string;
  amount: number;
  method: string;
  reference: string | null;
};

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  sent: "default",
  paid: "secondary",
  overdue: "destructive",
  void: "secondary",
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);

  function load() {
    fetch(`/api/invoices/${id}`)
      .then((r) => r.json())
      .then(setInvoice);
    fetch(`/api/invoices/${id}/payments`)
      .then((r) => r.json())
      .then(setPayments);
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSend() {
    await fetch(`/api/invoices/${id}/send`, { method: "POST" });
    load();
  }

  async function handleVoid() {
    if (!confirm("Void this invoice? This cannot be undone.")) return;
    await fetch(`/api/invoices/${id}/void`, { method: "POST" });
    load();
  }

  async function handleDelete() {
    if (!confirm("Delete this draft invoice?")) return;
    const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/invoices");
  }

  async function handleRecordPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPaymentSaving(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/invoices/${id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: form.get("date"),
        amount: Number(form.get("amount")),
        method: form.get("method"),
        reference: form.get("reference") || null,
      }),
    });
    if (res.ok) {
      setShowPaymentForm(false);
      load();
    }
    setPaymentSaving(false);
  }

  async function handleDeletePayment(paymentId: string) {
    if (!confirm("Remove this payment?")) return;
    await fetch(`/api/invoices/${id}/payments/${paymentId}`, { method: "DELETE" });
    load();
  }

  if (!invoice) return <div className="p-4">Loading...</div>;

  const isInvoice = invoice.type === "ACCREC";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{invoice.invoice_number}</h1>
          <p className="text-muted-foreground">
            {isInvoice ? "Invoice" : "Bill"} for{" "}
            <Link href={`/contacts/${invoice.contact_id}`} className="hover:underline">
              {invoice.contact_name}
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant[invoice.status] || "default"} className="text-sm px-3 py-1">
            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
          </Badge>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {invoice.status === "draft" && (
          <>
            <Button onClick={handleSend}>
              <Send className="mr-2 h-4 w-4" />Send
            </Button>
            <Button variant="outline" onClick={() => router.push(`/invoices/new?edit=${id}`)}>
              Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              Delete
            </Button>
          </>
        )}
        <a href={`/api/invoices/${id}/pdf`} target="_blank" rel="noopener noreferrer">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />PDF
          </Button>
        </a>
        {invoice.status !== "void" && invoice.status !== "draft" && (
          <Button variant="ghost" size="sm" onClick={handleVoid}>
            <Ban className="mr-2 h-4 w-4" />Void
          </Button>
        )}
      </div>

      {/* Invoice details */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <span className="text-sm text-muted-foreground">Date</span>
              <p className="font-medium">{invoice.date}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Due Date</span>
              <p className="font-medium">{invoice.due_date}</p>
            </div>
            {invoice.reference && (
              <div>
                <span className="text-sm text-muted-foreground">Reference</span>
                <p className="font-medium">{invoice.reference}</p>
              </div>
            )}
          </div>

          {/* Line items */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.line_items.map((li) => (
                <TableRow key={li.id}>
                  <TableCell>{li.description}</TableCell>
                  <TableCell className="text-right">{li.quantity}</TableCell>
                  <TableCell className="text-right">{fmt(li.unit_price)}</TableCell>
                  <TableCell className="text-right">{Math.round(li.gst_rate * 100)}%</TableCell>
                  <TableCell className="text-right">{fmt(li.line_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Totals */}
          <div className="ml-auto w-64 mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{fmt(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GST</span>
              <span>{fmt(invoice.gst_total)}</span>
            </div>
            <div className="flex justify-between font-bold border-t pt-2">
              <span>Total</span>
              <span>{fmt(invoice.total)}</span>
            </div>
            {invoice.amount_paid > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Paid</span>
                <span>{fmt(invoice.amount_paid)}</span>
              </div>
            )}
            {invoice.amount_due > 0 && invoice.amount_due !== invoice.total && (
              <div className="flex justify-between font-bold text-lg">
                <span>Amount Due</span>
                <span>{fmt(invoice.amount_due)}</span>
              </div>
            )}
          </div>

          {invoice.payment_instructions && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">Payment Instructions</p>
              <p className="text-sm text-muted-foreground">{invoice.payment_instructions}</p>
            </div>
          )}
          {invoice.notes && (
            <div className="mt-3 p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">Notes</p>
              <p className="text-sm text-muted-foreground">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Payments</CardTitle>
          {invoice.status !== "void" && invoice.status !== "draft" && invoice.amount_due > 0 && (
            <Button size="sm" variant="outline" onClick={() => setShowPaymentForm(!showPaymentForm)}>
              Record Payment
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showPaymentForm && (
            <form onSubmit={handleRecordPayment} className="grid grid-cols-4 gap-3 mb-4 p-3 border rounded-lg">
              <div>
                <Label>Date</Label>
                <Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
              </div>
              <div>
                <Label>Amount</Label>
                <Input name="amount" type="number" step="0.01" defaultValue={invoice.amount_due} required />
              </div>
              <div>
                <Label>Method</Label>
                <select name="method" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <Label>Reference</Label>
                <div className="flex gap-2">
                  <Input name="reference" placeholder="Ref #" />
                  <Button type="submit" disabled={paymentSaving} size="sm">
                    {paymentSaving ? "..." : "Save"}
                  </Button>
                </div>
              </div>
            </form>
          )}

          {payments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.date}</TableCell>
                    <TableCell className="text-right">{fmt(p.amount)}</TableCell>
                    <TableCell>{p.method.replace("_", " ")}</TableCell>
                    <TableCell>{p.reference || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePayment(p.id)}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No payments recorded.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
