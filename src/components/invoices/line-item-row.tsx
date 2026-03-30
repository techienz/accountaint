"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  gst_rate: number;
};

type Props = {
  item: LineItem;
  gstInclusive: boolean;
  onChange: (item: LineItem) => void;
  onRemove: () => void;
};

function calcLineTotal(item: LineItem, gstInclusive: boolean) {
  if (gstInclusive) {
    const lineTotal = (item.quantity * item.unit_price) / (1 + item.gst_rate);
    const gstAmount = item.quantity * item.unit_price - lineTotal;
    return { lineTotal, gstAmount, total: item.quantity * item.unit_price };
  }
  const lineTotal = item.quantity * item.unit_price;
  const gstAmount = lineTotal * item.gst_rate;
  return { lineTotal, gstAmount, total: lineTotal + gstAmount };
}

const fmt = (n: number) =>
  n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function LineItemRow({ item, gstInclusive, onChange, onRemove }: Props) {
  const { total } = calcLineTotal(item, gstInclusive);

  return (
    <div className="grid grid-cols-12 gap-2 items-center">
      <div className="col-span-5">
        <Input
          placeholder="Description"
          value={item.description}
          onChange={(e) => onChange({ ...item, description: e.target.value })}
        />
      </div>
      <div className="col-span-2">
        <Input
          type="number"
          step="0.01"
          placeholder="Qty"
          value={item.quantity || ""}
          onChange={(e) => onChange({ ...item, quantity: Number(e.target.value) || 0 })}
        />
      </div>
      <div className="col-span-2">
        <Input
          type="number"
          step="0.01"
          placeholder="Unit Price"
          value={item.unit_price || ""}
          onChange={(e) => onChange({ ...item, unit_price: Number(e.target.value) || 0 })}
        />
      </div>
      <div className="col-span-1">
        <select
          value={item.gst_rate}
          onChange={(e) => onChange({ ...item, gst_rate: Number(e.target.value) })}
          className="flex h-10 w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
        >
          <option value={0.15}>15%</option>
          <option value={0}>0%</option>
        </select>
      </div>
      <div className="col-span-1 text-right text-sm font-medium">
        ${fmt(total)}
      </div>
      <div className="col-span-1 text-right">
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}
