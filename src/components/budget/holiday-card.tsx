"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Link2, Upload, X, Sparkles, Loader2 } from "lucide-react";

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Holiday = {
  id: string;
  destination: string;
  date: string | null;
  year: number | null;
  accommodation_cost: number;
  travel_cost: number;
  spending_budget: number;
  other_costs: number;
  trip_type: string;
};

type Attachment = {
  id: string;
  name: string;
  type: "link" | "file";
  url: string | null;
  file_path: string | null;
};

export function HolidayCard({
  holiday,
  savingsGoalName,
  onEdit,
  onDelete,
}: {
  holiday: Holiday;
  savingsGoalName?: string | null;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const total =
    holiday.accommodation_cost +
    holiday.travel_cost +
    holiday.spending_budget +
    holiday.other_costs;

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showAddLink, setShowAddLink] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [itinerary, setItinerary] = useState<string | null>(null);
  const [showItinerary, setShowItinerary] = useState(false);
  const [generatingItinerary, setGeneratingItinerary] = useState(false);
  const [itineraryInterests, setItineraryInterests] = useState("");
  const [itineraryDays, setItineraryDays] = useState("7");
  const [itineraryError, setItineraryError] = useState<string | null>(null);
  const [showItineraryForm, setShowItineraryForm] = useState(false);

  const loadAttachments = useCallback(() => {
    fetch(`/api/budget/holidays/${holiday.id}/attachments`)
      .then((r) => r.json())
      .then(setAttachments)
      .catch(() => {});
  }, [holiday.id]);

  useEffect(() => { loadAttachments(); }, [loadAttachments]);

  async function addLink() {
    if (!linkName || !linkUrl) return;
    await fetch(`/api/budget/holidays/${holiday.id}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: linkName, url: linkUrl }),
    });
    setLinkName("");
    setLinkUrl("");
    setShowAddLink(false);
    loadAttachments();
  }

  async function uploadFile(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", file.name);
    await fetch(`/api/budget/holidays/${holiday.id}/attachments`, {
      method: "POST",
      body: fd,
    });
    loadAttachments();
  }

  async function removeAttachment(attachmentId: string) {
    await fetch(`/api/budget/holidays/${holiday.id}/attachments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachment_id: attachmentId }),
    });
    loadAttachments();
  }

  async function generateItinerary() {
    setGeneratingItinerary(true);
    setItineraryError(null);
    const res = await fetch(`/api/budget/holidays/${holiday.id}/itinerary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interests: itineraryInterests,
        days: Number(itineraryDays) || 7,
      }),
    });
    const data = await res.json();
    setGeneratingItinerary(false);
    if (!res.ok) {
      setItineraryError(data.error);
      return;
    }
    setItinerary(data.itinerary);
    setShowItinerary(true);
    setShowItineraryForm(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{holiday.destination}</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {holiday.trip_type === "international" ? "International" : "Domestic"}
          </Badge>
          {onEdit && (
            <button onClick={onEdit} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent">
              <Pencil className="h-3 w-3" /> Edit
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-destructive/10">
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {(holiday.year || holiday.date) && (
          <p className="text-xs text-muted-foreground">
            {holiday.date ?? holiday.year}
          </p>
        )}
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Accommodation</span>
            <span>{fmt(holiday.accommodation_cost)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Travel</span>
            <span>{fmt(holiday.travel_cost)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Spending</span>
            <span>{fmt(holiday.spending_budget)}</span>
          </div>
          {holiday.other_costs > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Other</span>
              <span>{fmt(holiday.other_costs)}</span>
            </div>
          )}
        </div>
        <div className="border-t pt-2 flex justify-between text-sm font-medium">
          <span>Total</span>
          <span>{fmt(total)}</span>
        </div>
        {savingsGoalName && (
          <p className="text-xs text-muted-foreground">
            Funded by: {savingsGoalName}
          </p>
        )}

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="border-t pt-2 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Attachments</p>
            {attachments.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  {a.type === "link" ? (
                    <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <Upload className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                  {a.type === "link" && a.url ? (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                      {a.name}
                    </a>
                  ) : (
                    <span className="truncate">{a.name}</span>
                  )}
                </div>
                <button onClick={() => removeAttachment(a.id)} className="text-muted-foreground hover:text-destructive shrink-0 ml-1">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add link form */}
        {showAddLink && (
          <div className="space-y-2 border-t pt-2">
            <Input
              placeholder="Name (e.g. Flight Booking)"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              className="h-8 text-xs"
            />
            <Input
              placeholder="URL"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="h-8 text-xs"
            />
            <div className="flex gap-1.5">
              <Button size="sm" className="h-7 text-xs" onClick={addLink}>Add</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAddLink(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Itinerary */}
        {showItineraryForm && (
          <div className="space-y-2 border-t pt-2">
            <p className="text-xs font-medium text-muted-foreground">Generate Itinerary</p>
            <Input
              placeholder="Interests (e.g. hiking, food, museums)"
              value={itineraryInterests}
              onChange={(e) => setItineraryInterests(e.target.value)}
              className="h-8 text-xs"
            />
            <Input
              placeholder="Number of days"
              type="number"
              value={itineraryDays}
              onChange={(e) => setItineraryDays(e.target.value)}
              className="h-8 text-xs"
            />
            {itineraryError && (
              <p className="text-xs text-red-600">{itineraryError}</p>
            )}
            <div className="flex gap-1.5">
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={generateItinerary}
                disabled={generatingItinerary}
              >
                {generatingItinerary ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Generating...</>
                ) : (
                  <><Sparkles className="h-3 w-3 mr-1" />Generate</>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setShowItineraryForm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {showItinerary && itinerary && (
          <div className="border-t pt-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Itinerary</p>
              <button
                onClick={() => setShowItinerary(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="text-xs whitespace-pre-wrap bg-accent/50 rounded-lg p-3 max-h-64 overflow-y-auto">
              {itinerary}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-1.5 pt-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setShowAddLink(!showAddLink)}
          >
            <Link2 className="h-3 w-3 mr-1" />Add Link
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) uploadFile(file);
              };
              input.click();
            }}
          >
            <Upload className="h-3 w-3 mr-1" />Upload
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => {
              if (showItinerary && itinerary) {
                setShowItinerary(true);
              } else {
                setShowItineraryForm(!showItineraryForm);
              }
            }}
          >
            <Sparkles className="h-3 w-3 mr-1" />Itinerary
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
