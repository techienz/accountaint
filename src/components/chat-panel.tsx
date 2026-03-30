"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, Send, Loader2 } from "lucide-react";
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

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type CitedSource = {
  guide: string;
  section: string;
};

export function ChatPanel({ businessId }: { businessId: string | null }) {
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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

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
        }
      } catch {
        // Silently fail
      }
      setHistoryLoaded(true);
    }

    loadHistory();
  }, [open, businessId, historyLoaded]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, statusMessage, scrollToBottom]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isStreaming || !businessId) return;

    setInput("");
    setSources([]);
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
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
        body: JSON.stringify({ message: text }),
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
          } catch {
            // Skip malformed SSE
          }
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
      <SheetContent side="right" className="sm:max-w-[400px] flex flex-col p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle>Tax Assistant</SheetTitle>
        </SheetHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-sm text-muted-foreground pt-8">
              <p className="font-medium mb-1">Ask me anything about your business</p>
              <p>Tax questions, GST calculations, financial reports, upcoming deadlines...</p>
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
                {msg.content ? (
                  msg.role === "assistant" ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  ) : (
                    msg.content
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

        {/* Input */}
        <div className="border-t p-3">
          <div className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              disabled={isStreaming}
              rows={1}
              className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            />
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={isStreaming || !input.trim()}
              aria-label="Send message"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
