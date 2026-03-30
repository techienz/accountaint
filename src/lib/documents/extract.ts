import { pdfToText } from "@/lib/knowledge/chunker";
import { routeTask } from "@/lib/ai/router";
import { localComplete } from "@/lib/lmstudio/llm";
import Anthropic from "@anthropic-ai/sdk";

let claudeClient: Anthropic | null = null;

function getClaudeClient(): Anthropic {
  if (claudeClient) return claudeClient;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required");
  }
  claudeClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return claudeClient;
}

export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string; pageCount?: number }> {
  if (mimeType === "application/pdf") {
    return extractPdfText(buffer);
  }

  if (mimeType.startsWith("image/")) {
    const text = await extractImageText(buffer, mimeType);
    return { text };
  }

  // Plain text files
  if (mimeType.startsWith("text/")) {
    return { text: buffer.toString("utf-8") };
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}

async function extractPdfText(
  buffer: Buffer
): Promise<{ text: string; pageCount?: number }> {
  const text = await pdfToText(buffer);
  // Rough page count estimate from form feeds or significant whitespace gaps
  const pageCount = (text.match(/\f/g) || []).length + 1;
  return { text, pageCount: pageCount > 1 ? pageCount : undefined };
}

async function extractImageText(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const route = await routeTask("ocr");

  if (route === "local") {
    // Local LLM via LM Studio — PII stays on device
    const base64 = buffer.toString("base64");
    const result = await localComplete({
      system:
        "You are a document OCR assistant. Extract all text from the provided image. " +
        "Preserve the structure and layout as much as possible. " +
        "Return only the extracted text, no commentary.",
      prompt: `[Image data: ${mimeType};base64,${base64}]\n\nExtract all text from this document image.`,
      maxTokens: 4096,
    });
    return result;
  }

  // Fallback: Claude Haiku (PII may be visible in image)
  const mediaType = mimeType as
    | "image/jpeg"
    | "image/png"
    | "image/gif"
    | "image/webp";
  const base64 = buffer.toString("base64");

  const response = await getClaudeClient().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: "Extract all text from this document image. Preserve the structure and layout. Return only the extracted text.",
          },
        ],
      },
    ],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}
