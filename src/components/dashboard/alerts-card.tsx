import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  read: boolean;
  created_at: Date;
};

export function AlertsCard({
  notifications,
}: {
  notifications: NotificationItem[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Recent Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent alerts.</p>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start gap-2">
                {!n.read && (
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && (
                    <p className="text-xs text-muted-foreground">{n.body}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
