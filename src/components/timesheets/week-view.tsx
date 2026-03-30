"use client";

import { EntryCard } from "./entry-card";
import { Plus } from "lucide-react";

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
  work_contract_id: string;
};

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WeekView({
  weekData,
  onDayClick,
  onEntryClick,
}: {
  weekData: Record<string, Entry[]>;
  onDayClick?: (date: string) => void;
  onEntryClick?: (entry: Entry) => void;
}) {
  const dates = Object.keys(weekData).sort();

  return (
    <div className="grid grid-cols-7 gap-2">
      {dates.map((date, i) => {
        const entries = weekData[date];
        const dayTotal = entries.reduce((sum, e) => sum + e.duration_minutes, 0);
        const hours = Math.round(dayTotal / 6) / 10;

        return (
          <div key={date} className="min-h-[120px]">
            <div className="flex items-center justify-between px-2 py-1.5 mb-1.5 rounded-md bg-muted/50">
              <div>
                <span className="text-xs font-medium">{dayNames[i]}</span>
                <span className="text-xs text-muted-foreground ml-1.5">
                  {new Date(date + "T00:00:00").getDate()}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {hours > 0 && (
                  <span className="text-xs font-medium">{hours}h</span>
                )}
                <button
                  onClick={() => onDayClick?.(date)}
                  className="flex items-center justify-center h-6 w-6 rounded-md bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                  title="Add time entry"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              {entries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  onClick={() => onEntryClick?.(entry)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
