import { getLmStudioClient, checkLmStudioHealth } from "./client";

export class LmStudioUnavailableError extends Error {
  constructor() {
    super("LM Studio is not available");
    this.name = "LmStudioUnavailableError";
  }
}

const EMBEDDING_MODEL = process.env.LMSTUDIO_EMBEDDING_MODEL || "nomic-ai/nomic-embed-text-v2-moe";
const MAX_BATCH_SIZE = 32;

export async function embed(text: string): Promise<number[]> {
  const available = await checkLmStudioHealth();
  if (!available) throw new LmStudioUnavailableError();

  const client = getLmStudioClient();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });

  return response.data[0].embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const available = await checkLmStudioHealth();
  if (!available) throw new LmStudioUnavailableError();

  const client = getLmStudioClient();
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });
    for (const item of response.data) {
      results.push(item.embedding);
    }
  }

  return results;
}
