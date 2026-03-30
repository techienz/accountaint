"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Database,
  Download,
  CheckCircle2,
  XCircle,
  Upload,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FolderSearch,
} from "lucide-react";

type GuideStatus = {
  code: string;
  title: string;
  url: string;
  loaded: boolean;
  chunkCount: number;
  lastFetched: string | null;
};

type KnowledgeStatus = {
  chunkCount: number;
  loadedCount: number;
  totalRequired: number;
  lastFetched: string | null;
  freshnessState: "fresh" | "aging" | "stale";
  daysSinceUpdate: number | null;
  guideDetails: GuideStatus[];
};

export function KnowledgeManager() {
  const [status, setStatus] = useState<KnowledgeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const customFileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<GuideStatus | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/knowledge/status");
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {
      // Status endpoint may fail if LanceDB not initialized
    }
    setLoading(false);
  }

  async function runIngest(mode: "seed" | "all") {
    setIngesting(true);
    setResult(null);
    try {
      const res = await fetch("/api/knowledge/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`Ingested ${data.chunksIngested} chunks successfully`);
        loadStatus();
      } else {
        setResult(`Error: ${data.error}`);
      }
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : "Failed"}`);
    }
    setIngesting(false);
  }

  async function handleUpload(guide: GuideStatus, file: File) {
    setUploading(guide.code);
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("code", guide.code);
    fd.append("title", guide.title);

    try {
      const res = await fetch("/api/knowledge/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`${guide.code}: Ingested ${data.chunksIngested} chunks`);
        loadStatus();
      } else {
        setResult(`Error: ${data.error}`);
      }
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : "Failed"}`);
    }
    setUploading(null);
  }

  async function runScan() {
    setScanning(true);
    setResult(null);
    try {
      const res = await fetch("/api/knowledge/scan", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const errors = data.results?.filter((r: { error?: string }) => r.error) || [];
        setResult(
          `Scanned ${data.filesProcessed} files — ${data.chunksIngested} chunks ingested` +
          (errors.length > 0 ? ` (${errors.length} failed)` : "")
        );
        loadStatus();
      } else {
        setResult(`Error: ${data.error}`);
      }
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : "Failed"}`);
    }
    setScanning(false);
  }

  function triggerUpload(guide: GuideStatus) {
    setUploadTarget(guide);
    fileRef.current?.click();
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && uploadTarget) {
      handleUpload(uploadTarget, file);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onCustomFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Derive guide code from filename: "ir340.pdf" -> "IR340", "ir340-2025.pdf" -> "IR340"
    const baseName = file.name.replace(/\.pdf$/i, "").replace(/-\d{4}$/, "");
    const code = baseName.toUpperCase();
    const guide: GuideStatus = {
      code,
      title: `Uploaded: ${file.name}`,
      url: "",
      loaded: false,
      chunkCount: 0,
      lastFetched: null,
    };
    await handleUpload(guide, file);
    if (customFileRef.current) customFileRef.current.value = "";
  }

  const freshnessColors: Record<string, string> = {
    fresh: "text-green-600",
    aging: "text-amber-600",
    stale: "text-red-600",
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking knowledge base...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hidden file inputs */}
      <Input
        ref={fileRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={onFileSelected}
      />
      <Input
        ref={customFileRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={onCustomFileSelected}
      />

      {/* Summary */}
      <div className="flex items-center gap-3">
        <Database className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">
          {status ? (
            <>
              {status.chunkCount} chunks from {status.loadedCount} guides
              {status.loadedCount < status.totalRequired && (
                <span className="text-muted-foreground">
                  {" "}({status.totalRequired - status.loadedCount} required guides missing)
                </span>
              )}
            </>
          ) : (
            "No knowledge loaded"
          )}
        </span>
        {status && status.chunkCount > 0 && (
          <Badge
            variant="outline"
            className={freshnessColors[status.freshnessState]}
          >
            {status.freshnessState === "fresh"
              ? "Up to date"
              : status.freshnessState === "aging"
                ? "Getting old"
                : "Stale"}
          </Badge>
        )}
      </div>

      {status?.lastFetched && (
        <p className="text-xs text-muted-foreground">
          Last updated:{" "}
          {new Date(status.lastFetched).toLocaleDateString("en-NZ", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          {status.daysSinceUpdate != null &&
            ` (${status.daysSinceUpdate} days ago)`}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => runIngest("all")}
          disabled={ingesting}
        >
          {ingesting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Download All from IRD
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={runScan}
          disabled={scanning || ingesting}
        >
          {scanning ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FolderSearch className="h-4 w-4 mr-2" />
          )}
          Scan Local Files
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => customFileRef.current?.click()}
          disabled={!!uploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Additional Guide
        </Button>
        <a
          href="https://www.ird.govt.nz/index/all-forms-and-guides#sort=relevancy&numberOfResults=25"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md border hover:bg-accent"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Browse IRD Guides
        </a>
      </div>

      {ingesting && (
        <p className="text-xs text-muted-foreground">
          Downloading PDFs from IRD and embedding via LM Studio. This may take a
          few minutes...
        </p>
      )}

      {result && (
        <p
          className={`text-sm ${result.startsWith("Error") ? "text-red-600" : "text-green-600"}`}
        >
          {result}
        </p>
      )}

      {/* Guide list */}
      {status && status.guideDetails.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            IRD Guides ({status.loadedCount} loaded{status.loadedCount < status.totalRequired ? `, ${status.totalRequired - status.loadedCount} missing` : ""})
          </button>

          {expanded && (
            <div className="mt-3 border rounded-lg divide-y">
              {status.guideDetails.map((guide) => (
                <div
                  key={guide.code}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {guide.loaded ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {guide.code}
                        </span>
                        <span className="text-sm text-muted-foreground truncate">
                          {guide.title}
                        </span>
                      </div>
                      {guide.loaded && (
                        <p className="text-xs text-muted-foreground">
                          {guide.chunkCount} chunks
                          {guide.lastFetched &&
                            ` · ${new Date(guide.lastFetched).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {guide.url && (
                      <a
                        href={guide.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent"
                        title="Download from IRD website"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <button
                      onClick={() => triggerUpload(guide)}
                      disabled={uploading === guide.code}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent disabled:opacity-50"
                      title="Upload PDF manually"
                    >
                      {uploading === guide.code ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Upload className="h-3 w-3" />
                      )}
                      Upload
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
