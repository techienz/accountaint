import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";

const statusConfig: Record<
  string,
  { label: string; icon: React.ElementType; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  pending: { label: "Pending", icon: Clock, variant: "outline" },
  processing: { label: "Processing", icon: Loader2, variant: "secondary" },
  completed: { label: "Extracted", icon: CheckCircle2, variant: "default" },
  failed: { label: "Failed", icon: AlertCircle, variant: "destructive" },
};

export function ExtractionStatus({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className={`h-3 w-3 ${status === "processing" ? "animate-spin" : ""}`} />
      {config.label}
    </Badge>
  );
}
