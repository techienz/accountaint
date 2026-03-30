"use client";

import { useCallback, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
];

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

type UploadDropzoneProps = {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
};

export function UploadDropzone({ onFileSelected, disabled }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null);

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Unsupported file type. Use PDF, JPEG, PNG, or text files.");
        return;
      }

      if (file.size > MAX_SIZE) {
        setError("File too large. Maximum size is 20MB.");
        return;
      }

      onFileSelected(file);
    },
    [onFileSelected]
  );

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSelect(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) validateAndSelect(file);
  }

  return (
    <div>
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium">
            Drop a file here or click to browse
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, JPEG, PNG — up to 20MB
          </p>
        </div>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.txt"
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
        />
      </label>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
