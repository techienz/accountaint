import { Badge } from "@/components/ui/badge";

type Entry = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number;
  description: string | null;
  billable: boolean;
  status: string;
  client_name: string;
  hourly_rate: number | null;
};

export function EntryCard({ entry, onClick }: { entry: Entry; onClick?: () => void }) {
  const hours = Math.round(entry.duration_minutes / 6) / 10;
  const earnings = entry.billable && entry.hourly_rate
    ? (entry.hourly_rate * entry.duration_minutes / 60)
    : 0;

  return (
    <div
      className="rounded-lg border p-2.5 text-sm space-y-1 cursor-pointer hover:border-primary/40 hover:bg-accent/30 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium truncate">{entry.client_name}</span>
        <span className="text-xs font-medium">{hours}h</span>
      </div>
      {entry.description && (
        <p className="text-xs text-muted-foreground truncate">{entry.description}</p>
      )}
      <div className="flex items-center gap-1.5">
        {entry.start_time && entry.end_time && (
          <span className="text-xs text-muted-foreground">
            {entry.start_time}–{entry.end_time}
          </span>
        )}
        {!entry.billable && (
          <Badge variant="secondary" className="text-[0.65rem] px-1 py-0">Non-billable</Badge>
        )}
        {earnings > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            ${earnings.toFixed(0)}
          </span>
        )}
      </div>
    </div>
  );
}
