"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, Send, Loader2, Trash2, Globe, Paperclip, X, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { usePageContext } from "@/components/page-context-provider";

type AttachmentMeta = {
  filename: string;
  mimetype: string;
  path: string;
  description?: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: AttachmentMeta[];
};

type CitedSource = {
  guide: string;
  section: string;
};

export function ChatPanel({ businessId }: { businessId: string | null }) {
  const { current: pageContext } = usePageContext();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [sources, setSources] = useState<CitedSource[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevBusinessId = useRef(businessId);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback((instant?: boolean) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? "instant" : "smooth" });
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(
      (f) =>
        ["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(f.type) &&
        f.size <= 10 * 1024 * 1024
    );
    setPendingFiles((prev) => [...prev, ...valid].slice(0, 3));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePendingFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // Reset when business changes
  useEffect(() => {
    if (prevBusinessId.current !== businessId) {
      setMessages([]);
      setHistoryLoaded(false);
      prevBusinessId.current = businessId;
    }
  }, [businessId]);

  // Load history when panel opens
  useEffect(() => {
    if (!open || !businessId || historyLoaded) return;

    async function loadHistory() {
      try {
        const res = await fetch("/api/chat/history");
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
          // Jump to bottom instantly (no visible scroll animation)
          requestAnimationFrame(() => scrollToBottom(true));
        }
      } catch {
        // Silently fail
      }
      setHistoryLoaded(true);
    }

    loadHistory();
  }, [open, businessId, historyLoaded, scrollToBottom]);

  useEffect(() => {
    if (isStreaming || statusMessage) {
      scrollToBottom();
    }
  }, [messages, statusMessage, isStreaming, scrollToBottom]);

  // Listen for "Explain This" button clicks from other components
  useEffect(() => {
    function handleExplain(e: Event) {
      const detail = (e as CustomEvent).detail as { message: string };
      setOpen(true);
      setTimeout(() => sendMessage(detail.message), 300);
    }

    window.addEventListener("explain-this", handleExplain);
    return () => window.removeEventListener("explain-this", handleExplain);
  }, [isStreaming, businessId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendMessage(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if ((!text && pendingFiles.length === 0) || isStreaming || !businessId) return;

    const filesToSend = [...pendingFiles];
    setInput("");
    setPendingFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSources([]);

    let uploadedAttachments: { filename: string; mimetype: string; path: string; messageId: string }[] = [];
    if (filesToSend.length > 0) {
      setUploading(true);

      const hasImages = filesToSend.some((f) => f.type.startsWith("image/"));
      if (hasImages) {
        try {
          const checkRes = await fetch("/api/chat/lm-status");
          const { available } = await checkRes.json();
          if (!available) {
            const proceed = confirm(
              "LM Studio is unavailable. Images will be sent directly to Claude API (PII may not be fully sanitised). Continue?"
            );
            if (!proceed) {
              setPendingFiles(filesToSend);
              setUploading(false);
              return;
            }
          }
        } catch { /* proceed anyway */ }
      }

      for (const file of filesToSend) {
        const formData = new FormData();
        formData.append("file", file);
        try {
          const res = await fetch("/api/chat/upload", { method: "POST", body: formData });
          if (res.ok) uploadedAttachments.push(await res.json());
        } catch { /* skip */ }
      }
      setUploading(false);
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text || "(attached files)",
      attachments: uploadedAttachments.map((a) => ({
        filename: a.filename,
        mimetype: a.mimetype,
        path: a.path,
      })),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setStatusMessage(null);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text || "Please analyze the attached file(s).",
          pageContext: pageContext
            ? {
                pageId: pageContext.pageId,
                title: pageContext.title,
                description: pageContext.description,
                dataSummary: pageContext.dataSummary,
              }
            : undefined,
          webSearchEnabled,
          attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Failed to send message");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            switch (event.type) {
              case "text":
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + event.content }
                      : m
                  )
                );
                break;
              case "status":
                setStatusMessage(event.message);
                break;
              case "sources":
                setSources(event.sources || []);
                break;
              case "web_source":
                setSources((prev) => [
                  ...prev,
                  { guide: event.title || "Web", section: event.url },
                ]);
                break;
              case "error":
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: `Error: ${event.message}` }
                      : m
                  )
                );
                break;
              case "done":
                setStatusMessage(null);
                break;
            }
          } catch { /* skip malformed SSE */ }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content:
                  err instanceof Error
                    ? `Error: ${err.message}`
                    : "Something went wrong. Please try again.",
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
      setStatusMessage(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  if (!businessId) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Open chat">
            <MessageSquare className="h-5 w-5" />
          </Button>
        }
      />
      <SheetContent side="right" className="!w-full sm:!w-[75vw] sm:max-w-[75vw] flex flex-col p-0">
        <SheetHeader className="border-b px-4 py-3 pr-12">
          <div className="flex items-center justify-between w-full">
            <SheetTitle>Tax Assistant</SheetTitle>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    await fetch("/api/chat/history", { method: "DELETE" });
                  } catch {
                    // Clear locally even if API fails
                  }
                  setMessages([]);
                  setSources([]);
                  setHistoryLoaded(true);
                }}
                disabled={isStreaming}
                className="text-muted-foreground hover:text-foreground h-7 px-2 text-xs gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-sm text-muted-foreground pt-8 space-y-4">
              <div>
                <p className="font-medium mb-1">Ask me anything about your business</p>
                <p>Tax questions, GST calculations, financial reports, upcoming deadlines...</p>
              </div>
              {pageContext?.suggestedQuestions && pageContext.suggestedQuestions.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
                    Suggested for this page
                  </p>
                  {pageContext.suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      className="block w-full text-left rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                    : "bg-muted prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-table:my-1 prose-hr:my-2"
                }`}
              >
                {/* Attachment previews */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex gap-2 mb-2">
                    {msg.attachments.map((att, i) => (
                      <div key={i} className="text-xs">
                        {att.mimetype.startsWith("image/") ? (
                          <img
                            src={`/api/chat/attachments/${att.path.replace("data/chat-attachments/", "")}`}
                            alt={att.filename}
                            className="rounded max-h-24 max-w-32 object-cover"
                          />
                        ) : (
                          <div className="flex items-center gap-1 bg-background/20 rounded px-2 py-1">
                            <FileText className="h-3 w-3" />
                            {att.filename}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {msg.content ? (
                  msg.role === "assistant" ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>
            </div>
          ))}

          {statusMessage && (
            <div className="flex justify-start">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                {statusMessage}
              </div>
            </div>
          )}

          {sources.length > 0 && !isStreaming && (
            <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
              <span className="font-medium">Sources: </span>
              {sources.map((s, i) => (
                <span key={i}>
                  {i > 0 && ", "}
                  {s.guide} — {s.section}
                </span>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Pending file previews */}
        {pendingFiles.length > 0 && (
          <div className="border-t px-3 pt-2 flex gap-2 flex-wrap">
            {pendingFiles.map((f, i) => (
              <div
                key={i}
                className="relative group flex items-center gap-1 bg-muted rounded px-2 py-1 text-xs"
              >
                {f.type.startsWith("image/") ? (
                  <img
                    src={URL.createObjectURL(f)}
                    alt={f.name}
                    className="h-8 w-8 rounded object-cover"
                  />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                <span className="max-w-[100px] truncate">{f.name}</span>
                <button
                  onClick={() => removePendingFile(i)}
                  className="ml-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t p-3">
          <div className="flex gap-2 items-end">
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${webSearchEnabled ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
                onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                title={webSearchEnabled ? "Web search on" : "Web search off"}
                disabled={isStreaming}
              >
                <Globe className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
                disabled={isStreaming || pendingFiles.length >= 3}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
                multiple
              />
            </div>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                const el = e.target;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 160) + "px";
              }}
              onKeyDown={handleKeyDown}
              placeholder={uploading ? "Uploading files..." : "Ask a question..."}
              disabled={isStreaming || uploading}
              rows={2}
              className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 min-h-[44px] max-h-[160px]"
            />
            <Button
              size="icon"
              onClick={() => sendMessage()}
              disabled={isStreaming || uploading || (!input.trim() && pendingFiles.length === 0)}
              aria-label="Send message"
            >
              {isStreaming || uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          {webSearchEnabled && (
            <p className="text-xs text-muted-foreground mt-1 ml-10">
              Web search enabled - queries will be sent to the web
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
