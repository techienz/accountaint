"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  read: boolean;
  created_at: string;
};

export function NotificationBell({
  businessId,
}: {
  businessId: string | null;
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!businessId) return;

    async function fetchNotifications() {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      } catch {
        // Silently fail
      }
    }

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [businessId]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          notifications.slice(0, 10).map((n) => (
            <DropdownMenuItem
              key={n.id}
              onClick={() => !n.read && markRead(n.id)}
              className="flex flex-col items-start gap-1 p-3"
            >
              <div className="flex items-center gap-2">
                {!n.read && (
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                )}
                <span className="text-sm font-medium">{n.title}</span>
              </div>
              {n.body && (
                <span className="text-xs text-muted-foreground">{n.body}</span>
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
