import { embed } from "@/lib/lmstudio/embeddings";
import { upsertRecords, searchTable } from "@/lib/vector/store";

const TABLE_NAME = "chat_memory";
const MIN_CONTENT_LENGTH = 200;

type ChatMemoryRecord = {
  id: string;
  business_id: string;
  role: string;
  content: string;
  created_at: string;
  vector: number[];
};

function sampleRecord(): ChatMemoryRecord {
  return {
    id: "__init__",
    business_id: "",
    role: "",
    content: "",
    created_at: "",
    vector: new Array(768).fill(0),
  };
}

export async function embedChatMessage(
  messageId: string,
  businessId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  // Only embed user questions and long assistant answers
  if (role === "assistant" && content.length < MIN_CONTENT_LENGTH) return;
  if (!content.trim()) return;

  const vector = await embed(content);

  const record: ChatMemoryRecord = {
    id: messageId,
    business_id: businessId,
    role,
    content: content.slice(0, 2000), // Cap stored content
    created_at: new Date().toISOString(),
    vector,
  };

  await upsertRecords(TABLE_NAME, [record]);
}

export type ChatMemoryResult = {
  role: string;
  content: string;
  createdAt: string;
};

export async function searchChatMemory(
  businessId: string,
  query: string,
  topK: number = 5
): Promise<ChatMemoryResult[]> {
  const queryVector = await embed(query);

  const results = await searchTable(
    TABLE_NAME,
    queryVector,
    topK,
    `business_id = "${businessId}"`
  );

  return results.map((r) => ({
    role: r.role as string,
    content: r.content as string,
    createdAt: r.created_at as string,
  }));
}
