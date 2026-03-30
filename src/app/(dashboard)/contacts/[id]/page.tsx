"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_number: string | null;
  type: string;
  default_due_days: number;
  notes: string | null;
};

type Invoice = {
  id: string;
  invoice_number: string;
  type: string;
  status: string;
  date: string;
  total: number;
  amount_due: number;
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

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/contacts/${id}`)
      .then((r) => r.json())
      .then(setContact);
    fetch(`/api/invoices?contact_id=${id}`)
      .then((r) => r.json())
      .then(setInvoices);
  }, [id]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
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

    const res = await fetch(`/api/contacts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const updated = await res.json();
      setContact(updated);
      setEditing(false);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this contact? This cannot be undone.")) return;
    const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/contacts");
    } else {
      const data = await res.json();
      alert(data.error || "Failed to delete");
    }
  }

  if (!contact) return <div className="p-4">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{contact.name}</h1>
        <div className="flex gap-2">
          {!editing && (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>Edit</Button>
              <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {editing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue={contact.name} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" defaultValue={contact.email ?? ""} />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" defaultValue={contact.phone ?? ""} />
                </div>
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" name="address" rows={2} defaultValue={contact.address ?? ""} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="type">Type</Label>
                  <select
                    id="type"
                    name="type"
                    defaultValue={contact.type}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  >
                    <option value="customer">Customer</option>
                    <option value="supplier">Supplier</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="default_due_days">Due Days</Label>
                  <Input id="default_due_days" name="default_due_days" type="number" defaultValue={contact.default_due_days} />
                </div>
                <div>
                  <Label htmlFor="tax_number">IRD / NZBN</Label>
                  <Input id="tax_number" name="tax_number" defaultValue={contact.tax_number ?? ""} />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={3} defaultValue={contact.notes ?? ""} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Email</span>
                  <p>{contact.email || "—"}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Phone</span>
                  <p>{contact.phone || "—"}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Type</span>
                  <p>{contact.type.charAt(0).toUpperCase() + contact.type.slice(1)}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Default Due Days</span>
                  <p>{contact.default_due_days}</p>
                </div>
              </div>
              {contact.address && (
                <div>
                  <span className="text-sm text-muted-foreground">Address</span>
                  <p>{contact.address}</p>
                </div>
              )}
              {contact.tax_number && (
                <div>
                  <span className="text-sm text-muted-foreground">IRD / NZBN</span>
                  <p>{contact.tax_number}</p>
                </div>
              )}
              {contact.notes && (
                <div>
                  <span className="text-sm text-muted-foreground">Notes</span>
                  <p>{contact.notes}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link href={`/invoices/${inv.id}`} className="font-medium hover:underline">
                        {inv.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell>{inv.date}</TableCell>
                    <TableCell className="text-right">{fmt(inv.total)}</TableCell>
                    <TableCell className="text-right">{fmt(inv.amount_due)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[inv.status] || "default"}>
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
