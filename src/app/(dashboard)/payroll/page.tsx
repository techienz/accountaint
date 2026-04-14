"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";

type PayRun = {
  id: string;
  period_start: string;
  period_end: string;
  pay_date: string;
  frequency: string;
  status: string;
};

export default function PayrollPage() {
  const [payRuns, setPayRuns] = useState<PayRun[]>([]);

  useEffect(() => {
    fetch("/api/payroll").then((r) => r.json()).then(setPayRuns);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payroll</h1>
          <p className="text-muted-foreground">Manage pay runs for your employees</p>
        </div>
        <Link href="/payroll/new">
          <Button><Plus className="mr-2 h-4 w-4" />New Pay Run</Button>
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pay Date</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Frequency</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payRuns.map((run) => (
            <TableRow key={run.id}>
              <TableCell className="font-medium">{run.pay_date}</TableCell>
              <TableCell>{run.period_start} to {run.period_end}</TableCell>
              <TableCell className="capitalize">{run.frequency}</TableCell>
              <TableCell>
                <Badge variant={run.status === "finalised" ? "default" : "outline"}>
                  {run.status === "finalised" ? "Finalised" : "Draft"}
                </Badge>
              </TableCell>
              <TableCell>
                <Link href={`/payroll/${run.id}`} className="text-sm text-primary hover:underline">
                  View
                </Link>
              </TableCell>
            </TableRow>
          ))}
          {payRuns.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                No pay runs yet. Create your first pay run to get started.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
