"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

type Employee = {
  id: string;
  name: string;
  employment_type: string;
  pay_type: string;
  pay_rate: number;
  leave_annual_balance: number;
  leave_sick_balance: number;
  is_active: boolean;
};

const employmentLabels: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  casual: "Casual",
};

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data) => setEmployees(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Employees</h1>
        <Link href="/employees/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        </Link>
      </div>

      {employees.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <p>No employees added yet.</p>
          <p className="text-sm">
            Add employees to track pay, leave balances, and tax obligations.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {employees.map((emp) => (
            <Link key={emp.id} href={`/employees/${emp.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{emp.name}</span>
                        {!emp.is_active && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {employmentLabels[emp.employment_type] ?? emp.employment_type}
                        {" \u00b7 "}
                        {emp.pay_type === "salary"
                          ? `${fmt(emp.pay_rate)}/yr`
                          : `${fmt(emp.pay_rate)}/hr`}
                      </p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>Annual: {emp.leave_annual_balance.toFixed(1)} days</p>
                      <p>Sick: {emp.leave_sick_balance.toFixed(1)} days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
