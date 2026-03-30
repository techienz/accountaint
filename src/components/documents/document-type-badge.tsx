import { Badge } from "@/components/ui/badge";

const typeLabels: Record<string, string> = {
  tax_return_ir4: "IR4 Return",
  tax_return_ir3: "IR3 Return",
  financial_statement: "Financial Statement",
  accountant_report: "Accountant Report",
  correspondence: "Correspondence",
  receipt_batch: "Receipt Batch",
  other: "Other",
};

const typeVariants: Record<string, "default" | "secondary" | "outline"> = {
  tax_return_ir4: "default",
  tax_return_ir3: "default",
  financial_statement: "secondary",
  accountant_report: "secondary",
  correspondence: "outline",
  receipt_batch: "outline",
  other: "outline",
};

export function DocumentTypeBadge({ type }: { type: string }) {
  return (
    <Badge variant={typeVariants[type] || "outline"}>
      {typeLabels[type] || type}
    </Badge>
  );
}
