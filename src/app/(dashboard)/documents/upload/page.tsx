"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadDropzone } from "@/components/documents/upload-dropzone";
import { FileText, Loader2 } from "lucide-react";

const typeOptions = [
  { value: "tax_return_ir4", label: "IR4 Company Tax Return" },
  { value: "tax_return_ir3", label: "IR3 Personal Tax Return" },
  { value: "financial_statement", label: "Financial Statement" },
  { value: "accountant_report", label: "Accountant Report" },
  { value: "correspondence", label: "Correspondence" },
  { value: "receipt_batch", label: "Receipt Batch" },
  { value: "other", label: "Other" },
];

// Generate tax years from 2018 to current + 1
function getTaxYears(): string[] {
  const current = new Date().getFullYear();
  const years: string[] = [];
  for (let y = current + 1; y >= 2018; y--) {
    years.push(String(y));
  }
  return years;
}

export default function UploadDocumentPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [documentType, setDocumentType] = useState("other");
  const [taxYear, setTaxYear] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileSelected(f: File) {
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please select a file");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("name", name || file.name);
      if (description) formData.set("description", description);
      formData.set("document_type", documentType);
      if (taxYear) formData.set("tax_year", taxYear);

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Upload failed");
      }

      const doc = await response.json();
      router.push(`/documents/${doc.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload Document</h1>
        <p className="text-muted-foreground">
          Add tax returns, financial statements, or accountant reports for AI review
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Document Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <UploadDropzone
              onFileSelected={handleFileSelected}
              disabled={uploading}
            />

            {file && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <span className="font-medium">{file.name}</span>
                <span className="text-muted-foreground ml-2">
                  ({(file.size / 1024).toFixed(0)} KB)
                </span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Document name"
                className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                disabled={uploading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notes about this document..."
                rows={2}
                className="w-full rounded-md border px-3 py-2 text-sm bg-background resize-none"
                disabled={uploading}
              />
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Document Type</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                  disabled={uploading}
                >
                  {typeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Tax Year (optional)</label>
                <select
                  value={taxYear}
                  onChange={(e) => setTaxYear(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                  disabled={uploading}
                >
                  <option value="">Not applicable</option>
                  {getTaxYears().map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" disabled={!file || uploading} className="w-full">
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload Document"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
