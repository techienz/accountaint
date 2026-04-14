"use client";

import { useRouter } from "next/navigation";
import { EmployeeForm } from "@/components/employees/employee-form";

export default function NewEmployeePage() {
  const router = useRouter();

  async function handleSubmit(data: Record<string, unknown>) {
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      router.push("/employees");
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Add Employee</h1>
      <EmployeeForm onSubmit={handleSubmit} />
    </div>
  );
}
