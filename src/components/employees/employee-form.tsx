"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

type Props = {
  onSubmit: (data: Record<string, unknown>) => void;
  initialData?: Record<string, unknown>;
};

export function EmployeeForm({ onSubmit, initialData }: Props) {
  const [name, setName] = useState((initialData?.name as string) ?? "");
  const [email, setEmail] = useState((initialData?.email as string) ?? "");
  const [phone, setPhone] = useState((initialData?.phone as string) ?? "");
  const [jobTitle, setJobTitle] = useState((initialData?.job_title as string) ?? "");
  const [department, setDepartment] = useState((initialData?.department as string) ?? "");
  const [irdNumber, setIrdNumber] = useState((initialData?.ird_number as string) ?? "");
  const [dateOfBirth, setDateOfBirth] = useState((initialData?.date_of_birth as string) ?? "");
  const [address, setAddress] = useState((initialData?.address as string) ?? "");
  const [emergencyName, setEmergencyName] = useState((initialData?.emergency_contact_name as string) ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState((initialData?.emergency_contact_phone as string) ?? "");
  const [startDate, setStartDate] = useState(
    (initialData?.start_date as string) ?? ""
  );
  const [employmentType, setEmploymentType] = useState(
    (initialData?.employment_type as string) ?? "full_time"
  );
  const [payType, setPayType] = useState(
    (initialData?.pay_type as string) ?? "salary"
  );
  const [payRate, setPayRate] = useState(
    initialData?.pay_rate != null ? String(initialData.pay_rate) : ""
  );
  const [hoursPerWeek, setHoursPerWeek] = useState(
    initialData?.hours_per_week != null
      ? String(initialData.hours_per_week)
      : "40"
  );
  const [taxCode, setTaxCode] = useState(
    (initialData?.tax_code as string) ?? "M"
  );
  const [kiwisaverEnrolled, setKiwisaverEnrolled] = useState(
    (initialData?.kiwisaver_enrolled as boolean) ?? true
  );
  const [ksEmployeeRate, setKsEmployeeRate] = useState(
    initialData?.kiwisaver_employee_rate != null
      ? String(Number(initialData.kiwisaver_employee_rate) * 100)
      : "3.5"
  );
  const [ksEmployerRate, setKsEmployerRate] = useState(
    initialData?.kiwisaver_employer_rate != null
      ? String(Number(initialData.kiwisaver_employer_rate) * 100)
      : "3.5"
  );
  const [hasStudentLoan, setHasStudentLoan] = useState(
    (initialData?.has_student_loan as boolean) ?? false
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    onSubmit({
      name,
      email: email || null,
      phone: phone || null,
      job_title: jobTitle || null,
      department: department || null,
      ird_number: irdNumber || null,
      date_of_birth: dateOfBirth || null,
      address: address || null,
      emergency_contact_name: emergencyName || null,
      emergency_contact_phone: emergencyPhone || null,
      start_date: startDate,
      employment_type: employmentType,
      pay_type: payType,
      pay_rate: Number(payRate),
      hours_per_week: Number(hoursPerWeek),
      tax_code: taxCode,
      kiwisaver_enrolled: kiwisaverEnrolled,
      kiwisaver_employee_rate: kiwisaverEnrolled
        ? Number(ksEmployeeRate) / 100
        : 0.035,
      kiwisaver_employer_rate: kiwisaverEnrolled
        ? Number(ksEmployerRate) / 100
        : 0.035,
      has_student_loan: hasStudentLoan,
    });

    setSaving(false);
  }

  const employmentLabels: Record<string, string> = {
    full_time: "Full-time",
    part_time: "Part-time",
    casual: "Casual",
  };

  const payTypeLabels: Record<string, string> = {
    salary: "Salary",
    hourly: "Hourly",
  };

  const taxCodeLabels: Record<string, string> = {
    M: "M \u2014 Primary employment",
    ME: "ME \u2014 Primary with extra pay",
    S: "S \u2014 Secondary employment",
    SH: "SH \u2014 Secondary, higher rate",
    SB: "SB \u2014 Secondary, lower rate",
  };

  const ksRateLabels: Record<string, string> = {
    "3.5": "3.5%",
    "4": "4%",
    "6": "6%",
    "8": "8%",
    "10": "10%",
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="job_title">Job Title</Label>
              <Input
                id="job_title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Software Developer"
              />
            </div>
            <div>
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ird_number">IRD Number</Label>
              <Input
                id="ird_number"
                value={irdNumber}
                onChange={(e) => setIrdNumber(e.target.value)}
                placeholder="e.g. 12-345-678"
              />
            </div>
            <div>
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Emergency Contact</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="emergency_name">Name</Label>
                <Input
                  id="emergency_name"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label htmlFor="emergency_phone">Phone</Label>
                <Input
                  id="emergency_phone"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Employment</p>
          </div>

          <div>
            <Label htmlFor="start_date">Start Date</Label>
            <Input
              id="start_date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          <div>
            <Label>Employment Type</Label>
            <Select
              value={employmentType}
              onValueChange={(v) => v && setEmploymentType(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue labels={employmentLabels} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_time">Full-time</SelectItem>
                <SelectItem value="part_time">Part-time</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Pay Type</Label>
            <Select
              value={payType}
              onValueChange={(v) => v && setPayType(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue labels={payTypeLabels} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="salary">Salary</SelectItem>
                <SelectItem value="hourly">Hourly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="pay_rate">
              {payType === "salary" ? "Annual Salary ($)" : "Hourly Rate ($)"}
            </Label>
            <Input
              id="pay_rate"
              type="number"
              min="0"
              step="0.01"
              value={payRate}
              onChange={(e) => setPayRate(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="hours_per_week">Hours Per Week</Label>
            <Input
              id="hours_per_week"
              type="number"
              min="0"
              step="0.5"
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(e.target.value)}
            />
          </div>

          <div>
            <Label>Tax Code</Label>
            <Select
              value={taxCode}
              onValueChange={(v) => v && setTaxCode(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue labels={taxCodeLabels} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">M — Primary employment</SelectItem>
                <SelectItem value="ME">ME — Primary with extra pay</SelectItem>
                <SelectItem value="S">S — Secondary employment</SelectItem>
                <SelectItem value="SH">SH — Secondary, higher rate</SelectItem>
                <SelectItem value="SB">SB — Secondary, lower rate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                id="kiwisaver"
                checked={kiwisaverEnrolled}
                onCheckedChange={setKiwisaverEnrolled}
              />
              <Label htmlFor="kiwisaver">KiwiSaver enrolled</Label>
            </div>

            {kiwisaverEnrolled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Employee Rate</Label>
                  <Select
                    value={ksEmployeeRate}
                    onValueChange={(v) => v && setKsEmployeeRate(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue labels={ksRateLabels} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3.5">3.5%</SelectItem>
                      <SelectItem value="4">4%</SelectItem>
                      <SelectItem value="6">6%</SelectItem>
                      <SelectItem value="8">8%</SelectItem>
                      <SelectItem value="10">10%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ks_employer_rate">Employer Rate (%)</Label>
                  <Input
                    id="ks_employer_rate"
                    type="number"
                    min="3.5"
                    step="0.1"
                    value={ksEmployerRate}
                    onChange={(e) => setKsEmployerRate(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum 3.5%
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="student_loan"
              checked={hasStudentLoan}
              onCheckedChange={setHasStudentLoan}
            />
            <Label htmlFor="student_loan">Has student loan</Label>
          </div>

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving..." : initialData ? "Update Employee" : "Add Employee"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
