import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NotificationActions } from "./notification-actions";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/settings?new=true");

  const params = await searchParams;
  const typeFilter = params.type || "all";
  const page = parseInt(params.page || "1");
  const perPage = 50;

  const db = getDb();
  const businessId = session.activeBusiness.id;

  let notifications = db
    .select()
    .from(schema.notificationItems)
    .where(eq(schema.notificationItems.business_id, businessId))
    .orderBy(desc(schema.notificationItems.created_at))
    .all();

  if (typeFilter !== "all") {
    notifications = notifications.filter((n) => n.type === typeFilter);
  }

  const total = notifications.length;
  const paginated = notifications.slice(0, page * perPage);
  const hasMore = paginated.length < total;

  const typeCounts = {
    all: notifications.length,
    deadline: notifications.filter((n) => n.type === "deadline").length,
    sync: notifications.filter((n) => n.type === "sync").length,
    tax: notifications.filter((n) => n.type === "tax").length,
    alert: notifications.filter((n) => n.type === "alert").length,
  };

  const typeColors: Record<string, string> = {
    deadline: "bg-blue-100 text-blue-800",
    sync: "bg-gray-100 text-gray-800",
    tax: "bg-purple-100 text-purple-800",
    alert: "bg-red-100 text-red-800",
    info: "bg-green-100 text-green-800",
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <NotificationActions businessId={businessId} />
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["all", "deadline", "sync", "tax", "alert"] as const).map((t) => (
          <a
            key={t}
            href={t === "all" ? "/notifications" : `/notifications?type=${t}`}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors ${
              typeFilter === t
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            <span className="text-xs opacity-70">
              ({typeCounts[t as keyof typeof typeCounts] || 0})
            </span>
          </a>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          {paginated.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications.</p>
          ) : (
            <div className="space-y-4">
              {paginated.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 p-3 rounded-md ${
                    !n.read ? "bg-muted/50" : ""
                  }`}
                >
                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                          typeColors[n.type] || "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {n.type}
                      </span>
                      <span className="text-sm font-medium">{n.title}</span>
                    </div>
                    {n.body && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {n.body}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {n.created_at.toLocaleDateString("en-NZ", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}

              {hasMore && (
                <a
                  href={`/notifications?${typeFilter !== "all" ? `type=${typeFilter}&` : ""}page=${page + 1}`}
                  className="block text-center text-sm text-primary hover:underline py-2"
                >
                  Load more
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
