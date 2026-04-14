"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";

type Employee = {
  id: string;
  name: string;
  start_date: string;
  employment_type: string;
  pay_type: string;
  pay_rate: number;
  hours_per_week: number;
  tax_code: string;
  kiwisaver_enrolled: boolean;
  kiwisaver_employee_rate: number;
  kiwisaver_employer_rate: number;
  has_student_loan: boolean;
  leave_annual_balance: number;
  leave_sick_balance: number;
  is_active: boolean;
};

type LeaveRecord = {
  id: string;
  type: string;
  start_date: string;
  end_date: string;
  days: number;
  notes: string | null;
  created_at: string;
};

const employmentLabels: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  casual: "Casual",
};

const leaveTypeLabels: Record<string, string> = {
  annual: "Annual",
  sick: "Sick",
  bereavement: "Bereavement",
  public_holiday: "Public Holiday",
  unpaid: "Unpaid",
};

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveType, setLeaveType] = useState("annual");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveDays, setLeaveDays] = useState("");
  const [leaveNotes, setLeaveNotes] = useState("");
  const [savingLeave, setSavingLeave] = useState(false);

  const loadData = useCallback(async () => {
    const [empRes, leaveRes] = await Promise.all([
      fetch(`/api/employees/${params.id}`),
      fetch(`/api/employees/${params.id}/leave`),
    ]);
    if (empRes.ok) setEmployee(await empRes.json());
    if (leaveRes.ok) setLeaveRecords(await leaveRes.json());
  }, [params.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleRecordLeave(e: React.FormEvent) {
    e.preventDefault();
    setSavingLeave(true);

    const res = await fetch(`/api/employees/${params.id}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: leaveType,
        start_date: leaveStart,
        end_date: leaveEnd,
        days: Number(leaveDays),
        notes: leaveNotes || null,
      }),
    });

    if (res.ok) {
      setShowLeaveForm(false);
      setLeaveType("annual");
      setLeaveStart("");
      setLeaveEnd("");
      setLeaveDays("");
      setLeaveNotes("");
      loadData();
    }
    setSavingLeave(false);
  }

  if (!employee) return <div>Loading...</div>;

  const sortedLeave = [...leaveRecords].sort(
    (a, b) => b.start_date.localeCompare(a.start_date)
  );

  return (
    <div className="space-y-6">
      <Link
        href="/employees"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to employees
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{employee.name}</h1>
        <p className="text-muted-foreground">
          {employmentLabels[employee.employment_type] ?? employee.employment_type}
          {" \u00b7 Started "}
          {employee.start_date}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pay</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">
              {fmt(employee.pay_rate)}
            </span>
            <span className="text-sm text-muted-foreground">
              {employee.pay_type === "salary" ? "/yr" : "/hr"}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Annual Leave</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">
              {employee.leave_annual_balance.toFixed(1)}
            </span>
            <span className="text-sm text-muted-foreground"> days</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sick Leave</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">
              {employee.leave_sick_balance.toFixed(1)}
            </span>
            <span className="text-sm text-muted-foreground"> days</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">KiwiSaver</CardTitle>
          </CardHeader>
          <CardContent>
            {employee.kiwisaver_enrolled ? (
              <>
                <span className="text-2xl font-bold">
                  {(employee.kiwisaver_employee_rate * 100).toFixed(1)}%
                </span>
                <span className="text-sm text-muted-foreground">
                  {" "}
                  + {(employee.kiwisaver_employer_rate * 100).toFixed(1)}%
                  employer
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Not enrolled</span>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <Button
          variant={showLeaveForm ? "outline" : "default"}
          onClick={() => setShowLeaveForm(!showLeaveForm)}
        >
          {showLeaveForm ? "Cancel" : "Record Leave"}
        </Button>

        {showLeaveForm && (
          <Card className="mt-4">
            <CardContent className="pt-6">
              <form onSubmit={handleRecordLeave} className="space-y-4">
                <div>
                  <Label>Leave Type</Label>
                  <Select
                    value={leaveType}
                    onValueChange={(v) => v && setLeaveType(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue labels={leaveTypeLabels} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="annual">Annual</SelectItem>
                      <SelectItem value="sick">Sick</SelectItem>
                      <SelectItem value="bereavement">Bereavement</SelectItem>
                      <SelectItem value="public_holiday">
                        Public Holiday
                      </SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="leave_start">Start Date</Label>
                    <Input
                      id="leave_start"
                      type="date"
                      value={leaveStart}
                      onChange={(e) => setLeaveStart(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="leave_end">End Date</Label>
                    <Input
                      id="leave_end"
                      type="date"
                      value={leaveEnd}
                      onChange={(e) => setLeaveEnd(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="leave_days">Days</Label>
                  <Input
                    id="leave_days"
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={leaveDays}
                    onChange={(e) => setLeaveDays(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="leave_notes">Notes</Label>
                  <Input
                    id="leave_notes"
                    value={leaveNotes}
                    onChange={(e) => setLeaveNotes(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <Button type="submit" disabled={savingLeave}>
                  {savingLeave ? "Saving..." : "Save"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      {sortedLeave.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Leave History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedLeave.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {leaveTypeLabels[record.type] ?? record.type}
                      </Badge>
                      <span className="text-sm font-medium">
                        {record.days} day{record.days !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {record.start_date} to {record.end_date}
                      {record.notes && ` \u2014 ${record.notes}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
