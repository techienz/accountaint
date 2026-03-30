"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type SavingsGoal = {
  id: string;
  name: string;
  current_balance: number;
  target_amount: number | null;
  fortnightly_contribution: number;
  status: string;
};

export function SavingsProgress({ goal, onEdit, onDelete }: { goal: SavingsGoal; onEdit?: () => void; onDelete?: () => void }) {
  const pct =
    goal.target_amount && goal.target_amount > 0
      ? Math.min(100, (goal.current_balance / goal.target_amount) * 100)
      : null;

  const fortnightsToTarget =
    goal.target_amount && goal.fortnightly_contribution > 0
      ? Math.ceil(
          (goal.target_amount - goal.current_balance) / goal.fortnightly_contribution
        )
      : null;

  const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
    active: "default",
    reached: "secondary",
    paused: "outline",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{goal.name}</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant[goal.status] ?? "default"}>
            {goal.status.charAt(0).toUpperCase() + goal.status.slice(1)}
          </Badge>
          {onEdit && (
            <button onClick={onEdit} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent">
              <Pencil className="h-3 w-3" /> Edit
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-destructive/10">
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Current balance</span>
          <span className="font-medium">{fmt(goal.current_balance)}</span>
        </div>
        {goal.target_amount != null && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Target</span>
            <span className="font-medium">{fmt(goal.target_amount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Fortnightly contribution</span>
          <span className="font-medium">{fmt(goal.fortnightly_contribution)}</span>
        </div>

        {pct != null && (
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{pct.toFixed(1)}%</span>
              {fortnightsToTarget != null && fortnightsToTarget > 0 && (
                <span>~{fortnightsToTarget} fortnights to go</span>
              )}
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
