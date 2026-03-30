"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { HolidayCard } from "@/components/budget/holiday-card";
import { Plus } from "lucide-react";

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Holiday = {
  id: string;
  destination: string;
  date: string | null;
  year: number | null;
  accommodation_cost: number;
  travel_cost: number;
  spending_budget: number;
  other_costs: number;
  trip_type: string;
  savings_goal_id: string | null;
};

type SavingsGoal = {
  id: string;
  name: string;
};

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);

  const load = useCallback(() => {
    fetch("/api/budget/holidays").then((r) => r.json()).then(setHolidays);
    fetch("/api/budget/savings").then((r) => r.json()).then(setGoals);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addHoliday(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/budget/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: fd.get("destination"),
        date: fd.get("date") || null,
        year: fd.get("year") ? Number(fd.get("year")) : null,
        accommodation_cost: Number(fd.get("accommodation_cost") || 0),
        travel_cost: Number(fd.get("travel_cost") || 0),
        spending_budget: Number(fd.get("spending_budget") || 0),
        other_costs: Number(fd.get("other_costs") || 0),
        trip_type: fd.get("trip_type") || "domestic",
        savings_goal_id: fd.get("savings_goal_id") || null,
      }),
    });
    setShowAdd(false);
    load();
  }

  async function saveHoliday(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingHoliday) return;
    const fd = new FormData(e.currentTarget);
    await fetch(`/api/budget/holidays/${editingHoliday.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: fd.get("destination"),
        date: fd.get("date") || null,
        year: fd.get("year") ? Number(fd.get("year")) : null,
        accommodation_cost: Number(fd.get("accommodation_cost") || 0),
        travel_cost: Number(fd.get("travel_cost") || 0),
        spending_budget: Number(fd.get("spending_budget") || 0),
        other_costs: Number(fd.get("other_costs") || 0),
        trip_type: fd.get("trip_type") || "domestic",
        savings_goal_id: fd.get("savings_goal_id") || null,
      }),
    });
    setEditingHoliday(null);
    load();
  }

  async function deleteHoliday(id: string) {
    await fetch(`/api/budget/holidays/${id}`, { method: "DELETE" });
    load();
  }

  const total = holidays.reduce(
    (s, h) => s + h.accommodation_cost + h.travel_cost + h.spending_budget + h.other_costs,
    0
  );

  const goalName = (id: string | null) =>
    goals.find((g) => g.id === id)?.name ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Holiday Planner</h1>
          <p className="text-muted-foreground">Plan trips and track holiday budgets</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />Add Holiday
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Holiday</DialogTitle></DialogHeader>
            <form onSubmit={addHoliday} className="space-y-4">
              <div><Label>Destination</Label><Input name="destination" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Date</Label><Input name="date" type="date" /></div>
                <div><Label>Year</Label><Input name="year" type="number" step="1" /></div>
              </div>
              <div>
                <Label>Trip Type</Label>
                <Select name="trip_type" defaultValue="domestic">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="domestic">Domestic</SelectItem>
                    <SelectItem value="international">International</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Accommodation</Label><Input name="accommodation_cost" type="number" step="any" defaultValue={0} /></div>
              <div><Label>Travel</Label><Input name="travel_cost" type="number" step="any" defaultValue={0} /></div>
              <div><Label>Spending Budget</Label><Input name="spending_budget" type="number" step="any" defaultValue={0} /></div>
              <div><Label>Other Costs</Label><Input name="other_costs" type="number" step="any" defaultValue={0} /></div>
              {goals.length > 0 && (
                <div>
                  <Label>Link to Savings Goal</Label>
                  <Select name="savings_goal_id">
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      {goals.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button type="submit">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {total > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total planned holiday spending</span>
              <span className="text-2xl font-bold">{fmt(total)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {holidays.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {holidays.map((h) => (
            <HolidayCard
              key={h.id}
              holiday={h}
              savingsGoalName={goalName(h.savings_goal_id)}
              onEdit={() => setEditingHoliday(h)}
              onDelete={() => deleteHoliday(h.id)}
            />
          ))}
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-12">
          No holidays planned yet. Add your first trip to start planning.
        </p>
      )}

      {/* Edit Holiday Dialog */}
      <Dialog open={!!editingHoliday} onOpenChange={(open) => { if (!open) setEditingHoliday(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Holiday</DialogTitle></DialogHeader>
          {editingHoliday && (
            <form onSubmit={saveHoliday} className="space-y-4">
              <div><Label>Destination</Label><Input name="destination" defaultValue={editingHoliday.destination} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Date</Label><Input name="date" type="date" defaultValue={editingHoliday.date ?? ""} /></div>
                <div><Label>Year</Label><Input name="year" type="number" step="1" defaultValue={editingHoliday.year ?? ""} /></div>
              </div>
              <div>
                <Label>Trip Type</Label>
                <Select name="trip_type" defaultValue={editingHoliday.trip_type}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="domestic">Domestic</SelectItem>
                    <SelectItem value="international">International</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Accommodation</Label><Input name="accommodation_cost" type="number" step="any" defaultValue={editingHoliday.accommodation_cost} /></div>
              <div><Label>Travel</Label><Input name="travel_cost" type="number" step="any" defaultValue={editingHoliday.travel_cost} /></div>
              <div><Label>Spending Budget</Label><Input name="spending_budget" type="number" step="any" defaultValue={editingHoliday.spending_budget} /></div>
              <div><Label>Other Costs</Label><Input name="other_costs" type="number" step="any" defaultValue={editingHoliday.other_costs} /></div>
              {goals.length > 0 && (
                <div>
                  <Label>Link to Savings Goal</Label>
                  <Select name="savings_goal_id" defaultValue={editingHoliday.savings_goal_id ?? undefined}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      {goals.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button type="submit">Save</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
