"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function NotificationActions({ businessId }: { businessId: string }) {
  const router = useRouter();

  async function handleMarkAllRead() {
    await fetch("/api/notifications/mark-all-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId }),
    });
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
      Mark all read
    </Button>
  );
}
