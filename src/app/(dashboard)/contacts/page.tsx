"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, ArrowRight } from "lucide-react";

type Contact = {
  id: string;
  name: string;
  email: string | null;
  type: string;
  default_due_days: number;
};

const typeVariant: Record<string, "default" | "secondary" | "outline"> = {
  customer: "default",
  supplier: "secondary",
  both: "outline",
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    fetch("/api/contacts")
      .then((r) => r.json())
      .then(setContacts);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">
            Manage your customers and suppliers
          </p>
        </div>
        <Link href="/contacts/new">
          <Button><Plus className="mr-2 h-4 w-4" />Add Contact</Button>
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Due Days</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((c) => (
            <TableRow key={c.id} className="group cursor-pointer hover:bg-accent/50" onClick={() => window.location.href = `/contacts/${c.id}`}>
              <TableCell>
                <Link href={`/contacts/${c.id}`} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                  {c.name}
                </Link>
              </TableCell>
              <TableCell>{c.email || "—"}</TableCell>
              <TableCell>
                <Badge variant={typeVariant[c.type] || "default"}>
                  {c.type.charAt(0).toUpperCase() + c.type.slice(1)}
                </Badge>
              </TableCell>
              <TableCell className="text-right">{c.default_due_days}</TableCell>
              <TableCell>
                <span className="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground flex items-center gap-1 transition-opacity">
                  View <ArrowRight className="h-3 w-3" />
                </span>
              </TableCell>
            </TableRow>
          ))}
          {contacts.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                No contacts yet. Add your first contact to start invoicing.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
