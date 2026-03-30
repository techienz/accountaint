"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DateRangePickerProps = {
  basePath: string;
  balanceDate: string;
};

export function DateRangePicker({ basePath, balanceDate }: DateRangePickerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPreset = searchParams.get("preset") || "this_tax_year";
  const currentFrom = searchParams.get("from") || "";
  const currentTo = searchParams.get("to") || "";

  const [customFrom, setCustomFrom] = useState(currentFrom);
  const [customTo, setCustomTo] = useState(currentTo);

  function handlePresetChange(preset: string | null) {
    if (!preset) return;
    if (preset === "custom") {
      const params = new URLSearchParams();
      params.set("preset", "custom");
      if (customFrom) params.set("from", customFrom);
      if (customTo) params.set("to", customTo);
      router.push(`${basePath}?${params.toString()}`);
    } else {
      router.push(`${basePath}?preset=${preset}`);
    }
  }

  function handleCustomApply() {
    if (!customFrom || !customTo) return;
    const params = new URLSearchParams();
    params.set("preset", "custom");
    params.set("from", customFrom);
    params.set("to", customTo);
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Select
          value={currentPreset}
          onValueChange={handlePresetChange}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue labels={{
              this_month: "This month",
              this_quarter: "This quarter",
              this_tax_year: "This tax year",
              ytd: "Year to date",
              last_tax_year: "Last tax year",
              custom: "Custom",
            }} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">This month</SelectItem>
            <SelectItem value="this_quarter">This quarter</SelectItem>
            <SelectItem value="this_tax_year">This tax year</SelectItem>
            <SelectItem value="ytd">Year to date</SelectItem>
            <SelectItem value="last_tax_year">Last tax year</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {currentPreset === "custom" && (
        <>
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="w-[160px]"
          />
          <span className="text-muted-foreground">to</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="w-[160px]"
          />
          <Button size="sm" onClick={handleCustomApply}>
            Apply
          </Button>
        </>
      )}
    </div>
  );
}
