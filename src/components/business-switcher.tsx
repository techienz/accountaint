"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Plus, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type BusinessSwitcherProps = {
  businesses: { id: string; name: string }[];
  activeBusinessId: string | null;
};

export function BusinessSwitcher({
  businesses,
  activeBusinessId,
}: BusinessSwitcherProps) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const activeBusiness = businesses.find((b) => b.id === activeBusinessId);

  async function switchBusiness(id: string) {
    if (id === activeBusinessId) return;
    setSwitching(true);
    await fetch(`/api/businesses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "set_active" }),
    });
    router.refresh();
    setSwitching(false);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center justify-between rounded-xl border border-sidebar-border bg-sidebar-accent/50 px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer"
        disabled={switching}
      >
        <span className="flex items-center gap-2 truncate">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {activeBusiness?.name || "Select business"}
          </span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        {businesses.map((biz) => (
          <DropdownMenuItem
            key={biz.id}
            onClick={() => switchBusiness(biz.id)}
            className={biz.id === activeBusinessId ? "bg-accent" : ""}
          >
            <Building2 className="mr-2 h-4 w-4" />
            {biz.name}
          </DropdownMenuItem>
        ))}
        {businesses.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={() => router.push("/settings?new=true")}>
          <Plus className="mr-2 h-4 w-4" />
          Add business
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
