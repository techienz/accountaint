"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssetForm } from "@/components/assets/asset-form";

export default function NewAssetPage() {
  const router = useRouter();

  async function handleSubmit(data: Record<string, unknown>) {
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

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
      <AssetForm onSubmit={handleSubmit} />
    </div>
  );
}
