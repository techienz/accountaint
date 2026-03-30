"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";

type ReceiptUploadProps = {
  onFileSelect: (file: File) => void;
  preview?: string | null;
};

export function ReceiptUpload({ onFileSelect, preview }: ReceiptUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(preview || null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    onFileSelect(file);
    if (file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file));
    }
  }

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <p className="text-sm text-muted-foreground">
          Drop a receipt here, click to browse, or use camera
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Supports JPEG, PNG, PDF
        </p>
      </div>
      {previewUrl && (
        <div className="relative">
          <img
            src={previewUrl}
            alt="Receipt preview"
            className="max-h-48 rounded-md border mx-auto"
          />
          <Button
            variant="outline"
            size="sm"
            className="absolute top-1 right-1"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewUrl(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
