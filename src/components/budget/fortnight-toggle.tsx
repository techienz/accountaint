"use client";

import { cn } from "@/lib/utils";

export function FortnightToggle({
  mode,
  onChange,
}: {
  mode: "fortnightly" | "monthly";
  onChange: (mode: "fortnightly" | "monthly") => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border bg-muted p-0.5">
      <button
        onClick={() => onChange("fortnightly")}
        className={cn(
          "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          mode === "fortnightly"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Fortnightly
      </button>
      <button
        onClick={() => onChange("monthly")}
        className={cn(
          "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          mode === "monthly"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Monthly
      </button>
    </div>
  );
}
