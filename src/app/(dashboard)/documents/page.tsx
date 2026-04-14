"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Plus, FolderOpen, FileText, X, Inbox } from "lucide-react";

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
  folder_id: string | null;
  folder_name: string | null;
};

type Folder = {
  id: string;
  name: string;
  icon: string;
  isSystem: boolean;
  documentCount: number;
};

type FoldersResponse = {
  folders: Folder[];
  totalDocuments: number;
  unfiledCount: number;
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

type SelectedFolder = "all" | "unfiled" | string;

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [foldersData, setFoldersData] = useState<FoldersResponse | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<SelectedFolder>("all");
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  const fetchFolders = useCallback(() => {
    fetch("/api/documents/folders")
      .then((r) => r.json())
      .then(setFoldersData);
  }, []);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (yearFilter) params.set("tax_year", yearFilter);
    if (selectedFolder !== "all") {
      if (selectedFolder === "unfiled") {
        params.set("folder_id", "unfiled");
      } else {
        params.set("folder_id", selectedFolder);
      }
    }
    fetch(`/api/documents?${params}`)
      .then((r) => r.json())
      .then(setDocuments);
  }, [typeFilter, yearFilter, selectedFolder]);

  const years = [
    ...new Set(documents.map((d) => d.tax_year).filter(Boolean)),
  ] as string[];

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setCreatingFolder(true);
    try {
      const res = await fetch("/api/documents/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setNewFolderName("");
        setShowNewFolder(false);
        fetchFolders();
      }
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleDeleteFolder(folderId: string) {
    const res = await fetch(`/api/documents/folders/${folderId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      if (selectedFolder === folderId) setSelectedFolder("all");
      fetchFolders();
    }
  }

  const uploadHref =
    selectedFolder !== "all" && selectedFolder !== "unfiled"
      ? `/documents/upload?folder_id=${selectedFolder}`
      : "/documents/upload";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Document Vault</h1>
          <p className="text-muted-foreground">
            Upload and review tax returns, financial statements, and reports
          </p>
        </div>
        <Link href={uploadHref}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
        </Link>
      </div>

      <div className="flex gap-6">
        {/* Folder Sidebar */}
        <div className="w-[220px] shrink-0 space-y-1">
          <SidebarItem
            icon={<FileText className="h-4 w-4" />}
            label="All Documents"
            count={foldersData?.totalDocuments ?? 0}
            selected={selectedFolder === "all"}
            onClick={() => setSelectedFolder("all")}
          />

          {foldersData?.folders.map((folder) => (
            <SidebarItem
              key={folder.id}
              icon={
                <span className="text-sm leading-none">{folder.icon}</span>
              }
              label={folder.name}
              count={folder.documentCount}
              selected={selectedFolder === folder.id}
              onClick={() => setSelectedFolder(folder.id)}
              onDelete={
                !folder.isSystem
                  ? () => handleDeleteFolder(folder.id)
                  : undefined
              }
            />
          ))}

          {(foldersData?.unfiledCount ?? 0) > 0 && (
            <SidebarItem
              icon={<Inbox className="h-4 w-4" />}
              label="Unfiled"
              count={foldersData?.unfiledCount ?? 0}
              selected={selectedFolder === "unfiled"}
              onClick={() => setSelectedFolder("unfiled")}
            />
          )}

          <div className="pt-2">
            {showNewFolder ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFolder();
                    if (e.key === "Escape") {
                      setShowNewFolder(false);
                      setNewFolderName("");
                    }
                  }}
                  placeholder="Folder name"
                  className="w-full rounded-md border px-2 py-1 text-sm bg-background"
                  disabled={creatingFolder}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCreateFolder}
                  disabled={creatingFolder || !newFolderName.trim()}
                  className="h-7 w-7 p-0 shrink-0"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewFolder(true)}
                className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                New Folder
              </button>
            )}
          </div>
        </div>

        {/* Document Table */}
        <div className="flex-1 min-w-0 space-y-4">
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
                {
                  documents.filter((d) => d.extraction_status === "completed")
                    .length
                }
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Tax Years</p>
              <p className="text-2xl font-bold">{years.length || "\u2014"}</p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Folder</TableHead>
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
                  <TableCell className="text-muted-foreground">
                    {doc.folder_name || "\u2014"}
                  </TableCell>
                  <TableCell>{doc.tax_year || "\u2014"}</TableCell>
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
                    colSpan={7}
                    className="text-center text-muted-foreground py-8"
                  >
                    No documents yet. Upload tax returns, financial statements,
                    or accountant reports to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  count,
  selected,
  onClick,
  onDelete,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors ${
        selected
          ? "bg-primary text-primary-foreground"
          : "hover:bg-muted text-foreground"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate flex-1 text-left">{label}</span>
      <span
        className={`text-xs tabular-nums ${
          selected ? "text-primary-foreground/70" : "text-muted-foreground"
        }`}
      >
        {count}
      </span>
      {onDelete && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onDelete();
            }
          }}
          className={`shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 ${
            selected
              ? "hover:bg-primary-foreground/20"
              : "hover:bg-muted-foreground/20"
          }`}
        >
          <X className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}
