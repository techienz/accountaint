"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type AddBack = {
  accountName: string;
  amount: number;
  reason: string;
  suggested: boolean;
  enabled: boolean;
};

type Props = {
  addBacks: AddBack[];
  onChange: (addBacks: AddBack[]) => void;
};

export function AddbacksEditor({ addBacks, onChange }: Props) {
  const [items, setItems] = useState(addBacks);

  function toggle(index: number) {
    const updated = [...items];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    setItems(updated);
    onChange(updated);
  }

  function updateAmount(index: number, amount: number) {
    const updated = [...items];
    updated[index] = { ...updated[index], amount };
    setItems(updated);
    onChange(updated);
  }

  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-3">
      {items.map((ab, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded border p-3"
        >
          <Switch checked={ab.enabled} onCheckedChange={() => toggle(i)} />
          <div className="flex-1">
            <div className="font-medium">{ab.accountName}</div>
            <div className="text-xs text-muted-foreground">{ab.reason}</div>
          </div>
          <Input
            type="number"
            className="w-28"
            value={ab.amount}
            onChange={(e) => updateAmount(i, Number(e.target.value))}
            disabled={!ab.enabled}
          />
        </div>
      ))}
      <div className="text-right font-medium">
        Total:{" "}
        {fmt(
          items.filter((a) => a.enabled).reduce((sum, a) => sum + a.amount, 0)
        )}
      </div>
    </div>
  );
}
