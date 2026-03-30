"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type ReportHeaderProps = {
  title: string;
  dateRange?: { from: string; to: string };
  fromCache?: boolean;
};

export function ReportHeader({ title, dateRange, fromCache }: ReportHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {dateRange && (
          <p className="text-sm text-muted-foreground">
            {formatDisplayDate(dateRange.from)} — {formatDisplayDate(dateRange.to)}
          </p>
        )}
        {fromCache && (
          <p className="text-sm text-amber-600 mt-1">
            Showing cached data — Xero is disconnected
          </p>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.print()}
        data-print-hidden
      >
        <Printer className="h-4 w-4 mr-2" />
        Print
      </Button>
    </div>
  );
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
