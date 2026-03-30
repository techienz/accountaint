import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SyncStatus({ lastSync }: { lastSync: Date | null }) {
  if (!lastSync) return null;

  const hoursAgo = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
  const isStale = hoursAgo > 2;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <RefreshCw className="h-3.5 w-3.5" />
      <span>Last synced {timeAgo(lastSync)}</span>
      {isStale && (
        <Badge variant="secondary" className="text-[10px]">
          Stale
        </Badge>
      )}
    </div>
  );
}
