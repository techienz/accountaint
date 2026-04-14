"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AssetForm } from "@/components/assets/asset-form";

export default function NewAssetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialData = {
    name: searchParams.get("name") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    purchase_date: searchParams.get("purchase_date") ?? undefined,
    cost: searchParams.get("cost") ?? undefined,
    notes: searchParams.get("notes") ?? undefined,
  };
  const fromExpenseId = searchParams.get("from_expense_id");

  async function handleSubmit(data: Record<string, unknown>, receiptFile?: File) {
    let res: Response;

    if (receiptFile) {
      const formData = new FormData();
      for (const [key, value] of Object.entries(data)) {
        if (value != null) formData.append(key, String(value));
      }
      if (fromExpenseId) formData.append("from_expense_id", fromExpenseId);
      formData.append("receipt", receiptFile);
      res = await fetch("/api/assets", { method: "POST", body: formData });
    } else {
      res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          from_expense_id: fromExpenseId ?? undefined,
        }),
      });
    }

    if (res.ok) {
      const { is_low_value } = await res.json();
      if (is_low_value) {
        alert("This asset is below the low-value threshold and will be fully expensed in the purchase year.");
      }
      router.push("/assets");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Add Asset</h1>
      <AssetForm onSubmit={handleSubmit} initialData={initialData} />
    </div>
  );
}
