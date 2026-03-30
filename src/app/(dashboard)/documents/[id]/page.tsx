"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentTypeBadge } from "@/components/documents/document-type-badge";
import { ExtractionStatus } from "@/components/documents/extraction-status";
import {
  ArrowLeft,
  Copy,
  ChevronDown,
  ChevronRight,
  RotateCw,
  Trash2,
  MessageSquare,
} from "lucide-react";

type Document = {
  id: string;
  name: string;
  description: string | null;
  document_type: string;
  tax_year: string | null;
  file_size: number;
  mime_type: string;
  extraction_status: string;
  extracted_text: string | null;
  page_count: number | null;
  file_path: string;
  created_at: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [showText, setShowText] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/documents/${id}`)
      .then((r) => r.json())
      .then(setDoc)
      .finally(() => setLoading(false));
  }, [id]);

  // Poll for extraction completion
  useEffect(() => {
    if (!doc || (doc.extraction_status !== "pending" && doc.extraction_status !== "processing")) return;

    const interval = setInterval(() => {
      fetch(`/api/documents/${id}`)
        .then((r) => r.json())
        .then((updated) => {
          setDoc(updated);
          if (updated.extraction_status === "completed" || updated.extraction_status === "failed") {
            clearInterval(interval);
          }
        });
    }, 2000);

    return () => clearInterval(interval);
  }, [id, doc?.extraction_status]);

  async function handleRetryExtraction() {
    setExtracting(true);
    try {
      await fetch(`/api/documents/${id}/extract`, { method: "POST" });
      const updated = await fetch(`/api/documents/${id}`).then((r) => r.json());
      setDoc(updated);
    } finally {
      setExtracting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    router.push("/documents");
  }

  function handleCopy() {
    if (doc?.extracted_text) {
      navigator.clipboard.writeText(doc.extracted_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!doc) return <p className="text-destructive">Document not found</p>;

  const isPdf = doc.mime_type === "application/pdf";
  const isImage = doc.mime_type.startsWith("image/");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/documents">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{doc.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <DocumentTypeBadge type={doc.document_type} />
            {doc.tax_year && (
              <span className="text-sm text-muted-foreground">
                Tax year {doc.tax_year}
              </span>
            )}
            <ExtractionStatus status={doc.extraction_status} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* File Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {isPdf ? (
              <iframe
                src={`/api/documents/${doc.id}/file`}
                className="w-full h-[500px] rounded border"
                title={doc.name}
              />
            ) : isImage ? (
              <img
                src={`/api/documents/${doc.id}/file`}
                alt={doc.name}
                className="w-full rounded border"
              />
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground border rounded">
                Preview not available for this file type
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metadata */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">File size</span>
                <span>{formatSize(doc.file_size)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span>{doc.mime_type}</span>
              </div>
              {doc.page_count && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pages</span>
                  <span>{doc.page_count}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uploaded</span>
                <span>
                  {new Date(doc.created_at).toLocaleDateString("en-NZ")}
                </span>
              </div>
              {doc.description && (
                <div>
                  <span className="text-muted-foreground">Notes</span>
                  <p className="mt-1">{doc.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Link href={`/?prompt=Summarise my document "${doc.name}"`}>
              <Button variant="outline" className="w-full">
                <MessageSquare className="mr-2 h-4 w-4" />
                Ask AI about this document
              </Button>
            </Link>

            {(doc.extraction_status === "failed" ||
              doc.extraction_status === "pending") && (
              <Button
                variant="outline"
                onClick={handleRetryExtraction}
                disabled={extracting}
              >
                <RotateCw
                  className={`mr-2 h-4 w-4 ${extracting ? "animate-spin" : ""}`}
                />
                {extracting ? "Extracting..." : "Retry Extraction"}
              </Button>
            )}

            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deleting ? "Deleting..." : "Delete Document"}
            </Button>
          </div>
        </div>
      </div>

      {/* Extracted Text */}
      {doc.extracted_text && (
        <Card>
          <CardHeader>
            <button
              onClick={() => setShowText(!showText)}
              className="flex items-center gap-2 text-base font-semibold"
            >
              {showText ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Extracted Text
              <span className="text-sm font-normal text-muted-foreground">
                ({doc.extracted_text.length.toLocaleString()} characters)
              </span>
            </button>
          </CardHeader>
          {showText && (
            <CardContent>
              <div className="flex justify-end mb-2">
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  <Copy className="mr-1 h-3 w-3" />
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md max-h-[500px] overflow-y-auto font-mono">
                {doc.extracted_text}
              </pre>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
