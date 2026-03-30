"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type MonthlyTarget = {
  month: string;
  gstComponent: number;
  incomeTaxComponent: number;
  totalTarget: number;
  actualSetAside: number | null;
};

type Props = {
  months: MonthlyTarget[];
  onUpdate: () => void;
};

export function MonthlyTable({ months, onUpdate }: Props) {
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  async function saveAmount(month: string) {
    setSaving(true);
    await fetch("/api/tax-savings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month,
        actual_set_aside: Number(editValue),
      }),
    });
    setEditingMonth(null);
    setSaving(false);
    onUpdate();
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Month</TableHead>
          <TableHead className="text-right">GST</TableHead>
          <TableHead className="text-right">Income Tax</TableHead>
          <TableHead className="text-right">Target</TableHead>
          <TableHead className="text-right">Set Aside</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {months.map((m) => (
          <TableRow key={m.month}>
            <TableCell className="font-medium">{m.month}</TableCell>
            <TableCell className="text-right">
              {fmt(m.gstComponent)}
            </TableCell>
            <TableCell className="text-right">
              {fmt(m.incomeTaxComponent)}
            </TableCell>
            <TableCell className="text-right font-medium">
              {fmt(m.totalTarget)}
            </TableCell>
            <TableCell className="text-right">
              {editingMonth === m.month ? (
                <Input
                  type="number"
                  step="0.01"
                  className="w-28 ml-auto"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                />
              ) : (
                <span
                  className={
                    m.actualSetAside != null &&
                    m.actualSetAside < m.totalTarget
                      ? "text-red-600"
                      : ""
                  }
                >
                  {m.actualSetAside != null
                    ? fmt(m.actualSetAside)
                    : "—"}
                </span>
              )}
            </TableCell>
            <TableCell>
              {editingMonth === m.month ? (
                <Button
                  size="sm"
                  onClick={() => saveAmount(m.month)}
                  disabled={saving}
                >
                  Save
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingMonth(m.month);
                    setEditValue(String(m.actualSetAside || ""));
                  }}
                >
                  Edit
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
