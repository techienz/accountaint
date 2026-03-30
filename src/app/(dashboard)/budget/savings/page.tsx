"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SavingsProgress } from "@/components/budget/savings-progress";
import { Plus } from "lucide-react";

type SavingsGoal = {
  id: string;
  name: string;
  current_balance: number;
  target_amount: number | null;
  fortnightly_contribution: number;
  status: string;
};

export default function SavingsPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);

  const load = useCallback(() => {
    fetch("/api/budget/savings").then((r) => r.json()).then(setGoals);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addGoal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/budget/savings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        current_balance: Number(fd.get("current_balance") || 0),
        target_amount: fd.get("target_amount") ? Number(fd.get("target_amount")) : null,
        fortnightly_contribution: Number(fd.get("fortnightly_contribution") || 0),
      }),
    });
    setShowAdd(false);
    load();
  }

  async function saveGoal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingGoal) return;
    const fd = new FormData(e.currentTarget);
    await fetch(`/api/budget/savings/${editingGoal.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        current_balance: Number(fd.get("current_balance") || 0),
        target_amount: fd.get("target_amount") ? Number(fd.get("target_amount")) : null,
        fortnightly_contribution: Number(fd.get("fortnightly_contribution") || 0),
      }),
    });
    setEditingGoal(null);
    load();
  }

  async function deleteGoal(id: string) {
    await fetch(`/api/budget/savings/${id}`, { method: "DELETE" });
    load();
  }

  const active = goals.filter((g) => g.status === "active");
  const other = goals.filter((g) => g.status !== "active");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Savings Goals</h1>
          <p className="text-muted-foreground">
            Track progress toward your savings targets
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />Add Goal
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Savings Goal</DialogTitle></DialogHeader>
            <form onSubmit={addGoal} className="space-y-4">
              <div><Label>Name</Label><Input name="name" required /></div>
              <div><Label>Current Balance</Label><Input name="current_balance" type="number" step="any" defaultValue={0} /></div>
              <div><Label>Target Amount (optional)</Label><Input name="target_amount" type="number" step="any" /></div>
              <div><Label>Fortnightly Contribution</Label><Input name="fortnightly_contribution" type="number" step="any" defaultValue={0} /></div>
              <Button type="submit">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {active.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {active.map((g) => (
            <SavingsProgress key={g.id} goal={g} onEdit={() => setEditingGoal(g)} onDelete={() => deleteGoal(g.id)} />
          ))}
        </div>
      )}

      {other.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Completed / Paused</h2>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {other.map((g) => (
              <SavingsProgress key={g.id} goal={g} onEdit={() => setEditingGoal(g)} onDelete={() => deleteGoal(g.id)} />
            ))}
          </div>
        </div>
      )}

      {goals.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          No savings goals yet. Add your first goal to start tracking.
        </p>
      )}

      {/* Edit Savings Goal Dialog */}
      <Dialog open={!!editingGoal} onOpenChange={(open) => { if (!open) setEditingGoal(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Savings Goal</DialogTitle></DialogHeader>
          {editingGoal && (
            <form onSubmit={saveGoal} className="space-y-4">
              <div><Label>Name</Label><Input name="name" defaultValue={editingGoal.name} required /></div>
              <div><Label>Current Balance</Label><Input name="current_balance" type="number" step="any" defaultValue={editingGoal.current_balance} /></div>
              <div><Label>Target Amount (optional)</Label><Input name="target_amount" type="number" step="any" defaultValue={editingGoal.target_amount ?? ""} /></div>
              <div><Label>Fortnightly Contribution</Label><Input name="fortnightly_contribution" type="number" step="any" defaultValue={editingGoal.fortnightly_contribution} /></div>
              <Button type="submit">Save</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
