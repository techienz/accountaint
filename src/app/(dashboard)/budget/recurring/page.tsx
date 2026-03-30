"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FortnightToggle } from "@/components/budget/fortnight-toggle";
import { Plus, Trash2, Pencil } from "lucide-react";

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const m2f = (m: number) => Math.round((m * 12) / 26 * 100) / 100;

type RecurringItem = {
  id: string;
  category_id: string | null;
  name: string;
  monthly_amount: number;
  due_day: number | null;
  frequency: string;
  is_debt: boolean;
  is_active: boolean;
};

type Income = {
  id: string;
  label: string;
  monthly_amount: number;
  is_active: boolean;
};

type Category = {
  id: string;
  name: string;
  color: string | null;
};

type OneOff = {
  id: string;
  name: string;
  amount: number;
  date: string;
  is_paid: boolean;
};

export default function RecurringPage() {
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [oneOffs, setOneOffs] = useState<OneOff[]>([]);
  const [mode, setMode] = useState<"fortnightly" | "monthly">("fortnightly");
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showAddOneOff, setShowAddOneOff] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [editingItem, setEditingItem] = useState<RecurringItem | null>(null);
  const [editingOneOff, setEditingOneOff] = useState<OneOff | null>(null);

  const load = useCallback(() => {
    fetch("/api/budget/recurring").then((r) => r.json()).then(setItems);
    fetch("/api/budget/incomes").then((r) => r.json()).then(setIncomes);
    fetch("/api/budget/one-off").then((r) => r.json()).then(setOneOffs);
  }, []);

  useEffect(() => {
    load();
    fetch("/api/budget/config").then((r) => r.json());
    fetch("/api/budget/overview").then((r) => r.json()).then((data) => {
      if (data.categoryBreakdown) {
        setCategories(
          data.categoryBreakdown.map((c: { id: string; name: string; color: string | null }) => ({
            id: c.id,
            name: c.name,
            color: c.color,
          }))
        );
      }
    });
  }, [load]);

  const isF = mode === "fortnightly";
  const display = (monthly: number) => fmt(isF ? m2f(monthly) : monthly);

  // ── Add handlers ──────────────────────────────────────────────────

  async function addItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/budget/recurring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        monthly_amount: Number(fd.get("monthly_amount")),
        due_day: fd.get("due_day") ? Number(fd.get("due_day")) : null,
        frequency: fd.get("frequency") || "monthly",
        category_id: fd.get("category_id") || null,
      }),
    });
    setShowAddItem(false);
    load();
  }

  async function addIncome(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/budget/incomes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: fd.get("label"),
        monthly_amount: Number(fd.get("monthly_amount")),
      }),
    });
    setShowAddIncome(false);
    load();
  }

  async function addOneOff(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/budget/one-off", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        amount: Number(fd.get("amount")),
        date: fd.get("date"),
      }),
    });
    setShowAddOneOff(false);
    load();
  }

  // ── Edit handlers ─────────────────────────────────────────────────

  async function saveIncome(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingIncome) return;
    const fd = new FormData(e.currentTarget);
    await fetch(`/api/budget/incomes/${editingIncome.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: fd.get("label"),
        monthly_amount: Number(fd.get("monthly_amount")),
      }),
    });
    setEditingIncome(null);
    load();
  }

  async function saveItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingItem) return;
    const fd = new FormData(e.currentTarget);
    await fetch(`/api/budget/recurring/${editingItem.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        monthly_amount: Number(fd.get("monthly_amount")),
        due_day: fd.get("due_day") ? Number(fd.get("due_day")) : null,
        frequency: fd.get("frequency") || "monthly",
        category_id: fd.get("category_id") || null,
        is_active: fd.get("is_active") === "on",
      }),
    });
    setEditingItem(null);
    load();
  }

  async function saveOneOff(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingOneOff) return;
    const fd = new FormData(e.currentTarget);
    await fetch(`/api/budget/one-off/${editingOneOff.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        amount: Number(fd.get("amount")),
        date: fd.get("date"),
        is_paid: fd.get("is_paid") === "on",
      }),
    });
    setEditingOneOff(null);
    load();
  }

  // ── Delete handlers ───────────────────────────────────────────────

  async function deleteItem(id: string) {
    await fetch(`/api/budget/recurring/${id}`, { method: "DELETE" });
    load();
  }

  async function deleteIncome(id: string) {
    await fetch(`/api/budget/incomes/${id}`, { method: "DELETE" });
    load();
  }

  async function deleteOneOff(id: string) {
    await fetch(`/api/budget/one-off/${id}`, { method: "DELETE" });
    load();
  }

  const catName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bills & Income</h1>
          <p className="text-muted-foreground">
            Manage recurring bills, income sources, and one-off expenses
          </p>
        </div>
        <FortnightToggle mode={mode} onChange={setMode} />
      </div>

      {/* ── Income Sources ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Income Sources</CardTitle>
          <Dialog open={showAddIncome} onOpenChange={setShowAddIncome}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="mr-1 h-4 w-4" />Add
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Income</DialogTitle></DialogHeader>
              <form onSubmit={addIncome} className="space-y-4">
                <div><Label>Label</Label><Input name="label" required /></div>
                <div><Label>Monthly Amount</Label><Input name="monthly_amount" type="number" step="any" required /></div>
                <Button type="submit">Save</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">{isF ? "Fortnightly" : "Monthly"}</TableHead>
                <TableHead className="w-[140px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {incomes.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.label}</TableCell>
                  <TableCell className="text-right">{display(i.monthly_amount)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setEditingIncome(i)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent">
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button onClick={() => deleteIncome(i.id)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-destructive/10">
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {incomes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                    No income sources yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Income Dialog */}
      <Dialog open={!!editingIncome} onOpenChange={(open) => { if (!open) setEditingIncome(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Income</DialogTitle></DialogHeader>
          {editingIncome && (
            <form onSubmit={saveIncome} className="space-y-4">
              <div><Label>Label</Label><Input name="label" defaultValue={editingIncome.label} required /></div>
              <div><Label>Monthly Amount</Label><Input name="monthly_amount" type="number" step="any" defaultValue={editingIncome.monthly_amount} required /></div>
              <Button type="submit">Save</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Recurring Bills ────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recurring Bills</CardTitle>
          <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="mr-1 h-4 w-4" />Add
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Recurring Item</DialogTitle></DialogHeader>
              <form onSubmit={addItem} className="space-y-4">
                <div><Label>Name</Label><Input name="name" required /></div>
                <div><Label>Monthly Amount</Label><Input name="monthly_amount" type="number" step="any" required /></div>
                <div><Label>Due Day (1-28)</Label><Input name="due_day" type="number" min={1} max={28} /></div>
                <div>
                  <Label>Frequency</Label>
                  <Select name="frequency" defaultValue="monthly">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="fortnightly">Fortnightly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {categories.length > 0 && (
                  <div>
                    <Label>Category</Label>
                    <Select name="category_id">
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button type="submit">Save</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">{isF ? "Fortnightly" : "Monthly"}</TableHead>
                <TableHead className="text-right">Due Day</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-[140px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{catName(item.category_id)}</TableCell>
                  <TableCell className="text-right">{display(item.monthly_amount)}</TableCell>
                  <TableCell className="text-right">{item.due_day ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{item.frequency}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.is_active ? "default" : "secondary"}>
                      {item.is_active ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setEditingItem(item)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent">
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button onClick={() => deleteItem(item.id)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-destructive/10">
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-4">
                    No recurring items yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Recurring Item Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => { if (!open) setEditingItem(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Recurring Item</DialogTitle></DialogHeader>
          {editingItem && (
            <form onSubmit={saveItem} className="space-y-4">
              <div><Label>Name</Label><Input name="name" defaultValue={editingItem.name} required /></div>
              <div><Label>Monthly Amount</Label><Input name="monthly_amount" type="number" step="any" defaultValue={editingItem.monthly_amount} required /></div>
              <div><Label>Due Day (1-28)</Label><Input name="due_day" type="number" min={1} max={28} defaultValue={editingItem.due_day ?? ""} /></div>
              <div>
                <Label>Frequency</Label>
                <Select name="frequency" defaultValue={editingItem.frequency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {categories.length > 0 && (
                <div>
                  <Label>Category</Label>
                  <Select name="category_id" defaultValue={editingItem.category_id ?? undefined}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input type="checkbox" name="is_active" id="edit_is_active" defaultChecked={editingItem.is_active} className="rounded border-input" />
                <Label htmlFor="edit_is_active">Active</Label>
              </div>
              <Button type="submit">Save</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── One-off Expenses ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">One-off Expenses</CardTitle>
          <Dialog open={showAddOneOff} onOpenChange={setShowAddOneOff}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="mr-1 h-4 w-4" />Add
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add One-off Expense</DialogTitle></DialogHeader>
              <form onSubmit={addOneOff} className="space-y-4">
                <div><Label>Name</Label><Input name="name" required /></div>
                <div><Label>Amount</Label><Input name="amount" type="number" step="any" required /></div>
                <div><Label>Date</Label><Input name="date" type="date" required /></div>
                <Button type="submit">Save</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead className="w-[140px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {oneOffs.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.name}</TableCell>
                  <TableCell className="text-right">{fmt(o.amount)}</TableCell>
                  <TableCell>{o.date}</TableCell>
                  <TableCell>
                    <Badge variant={o.is_paid ? "default" : "outline"}>
                      {o.is_paid ? "Paid" : "Unpaid"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setEditingOneOff(o)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent">
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button onClick={() => deleteOneOff(o.id)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-destructive/10">
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {oneOffs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                    No one-off expenses yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit One-off Dialog */}
      <Dialog open={!!editingOneOff} onOpenChange={(open) => { if (!open) setEditingOneOff(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit One-off Expense</DialogTitle></DialogHeader>
          {editingOneOff && (
            <form onSubmit={saveOneOff} className="space-y-4">
              <div><Label>Name</Label><Input name="name" defaultValue={editingOneOff.name} required /></div>
              <div><Label>Amount</Label><Input name="amount" type="number" step="any" defaultValue={editingOneOff.amount} required /></div>
              <div><Label>Date</Label><Input name="date" type="date" defaultValue={editingOneOff.date} required /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" name="is_paid" id="edit_is_paid" defaultChecked={editingOneOff.is_paid} className="rounded border-input" />
                <Label htmlFor="edit_is_paid">Paid</Label>
              </div>
              <Button type="submit">Save</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
