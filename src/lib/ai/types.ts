export type ChatRole = "user" | "assistant";

export type CitedSource = {
  guide: string;
  section: string;
  chunk_id: string;
  source_url?: string;
};

export type SanitisationMap = {
  originalToAnon: Map<string, string>;
  anonToOriginal: Map<string, string>;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  sanitised_content: string | null;
  created_at: Date;
};

export type StreamEvent =
  | { type: "text"; content: string }
  | { type: "status"; message: string }
  | { type: "sources"; sources: CitedSource[] }
  | { type: "web_source"; url: string; title: string }
  | { type: "done" }
  | { type: "error"; message: string };
