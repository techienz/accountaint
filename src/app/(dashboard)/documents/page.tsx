"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DocumentTypeBadge } from "@/components/documents/document-type-badge";
import { ExtractionStatus } from "@/components/documents/extraction-status";
import { Plus } from "lucide-react";

type Document = {
  id: string;
  name: string;
  document_type: string;
  tax_year: string | null;
  file_size: number;
  mime_type: string;
  extraction_status: string;
  page_count: number | null;
  created_at: string;
};

const typeOptions = [
  { value: "", label: "All types" },
  { value: "tax_return_ir4", label: "IR4 Return" },
  { value: "tax_return_ir3", label: "IR3 Return" },
  { value: "financial_statement", label: "Financial Statement" },
  { value: "accountant_report", label: "Accountant Report" },
  { value: "correspondence", label: "Correspondence" },
  { value: "receipt_batch", label: "Receipt Batch" },
  { value: "other", label: "Other" },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (yearFilter) params.set("tax_year", yearFilter);
    fetch(`/api/documents?${params}`)
      .then((r) => r.json())
      .then(setDocuments);
  }, [typeFilter, yearFilter]);

  const years = [...new Set(documents.map((d) => d.tax_year).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Document Vault</h1>
          <p className="text-muted-foreground">
            Upload and review tax returns, financial statements, and reports
          </p>
        </div>
        <Link href="/documents/upload">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
        </Link>
      </div>

      <div className="flex gap-3">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm bg-background"
        >
          {typeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm bg-background"
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Documents</p>
          <p className="text-2xl font-bold">{documents.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Extracted</p>
          <p className="text-2xl font-bold">
            {documents.filter((d) => d.extraction_status === "completed").length}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Tax Years</p>
          <p className="text-2xl font-bold">{years.length || "—"}</p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Tax Year</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Uploaded</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell>
                <Link
                  href={`/documents/${doc.id}`}
                  className="font-medium hover:underline"
                >
                  {doc.name}
                </Link>
              </TableCell>
              <TableCell>
                <DocumentTypeBadge type={doc.document_type} />
              </TableCell>
              <TableCell>{doc.tax_year || "—"}</TableCell>
              <TableCell>{formatSize(doc.file_size)}</TableCell>
              <TableCell>
                <ExtractionStatus status={doc.extraction_status} />
              </TableCell>
              <TableCell>
                {new Date(doc.created_at).toLocaleDateString("en-NZ")}
              </TableCell>
            </TableRow>
          ))}
          {documents.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-muted-foreground py-8"
              >
                No documents yet. Upload tax returns, financial statements, or
                accountant reports to get started.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
