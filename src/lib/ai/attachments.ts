import fs from "fs";
import path from "path";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { checkLmStudioHealth, getLmStudioClient } from "@/lib/lmstudio/client";
import { sanitise } from "@/lib/ai/sanitise";
import type { SanitisationMap } from "@/lib/ai/types";

type AttachmentInput = {
  filename: string;
  mimetype: string;
  path: string;
  messageId: string;
};

type AttachmentMeta = {
  filename: string;
  mimetype: string;
  path: string;
  description?: string;
};

type ProcessedAttachments = {
  contentBlocks: ContentBlockParam[];
  metadata: AttachmentMeta[];
};

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const IMAGE_DESCRIBE_PROMPT = `Describe this image in detail for a business accounting context.
Include: any text/numbers visible, what type of document or item it shows,
any amounts, dates, names, or reference numbers.
Be factual and thorough - this description will be used to answer
the user's question about this image.`;

export async function processAttachments(
  attachments: AttachmentInput[],
  sanitisationMap: SanitisationMap
): Promise<ProcessedAttachments> {
  const contentBlocks: ContentBlockParam[] = [];
  const metadata: AttachmentMeta[] = [];

  for (const att of attachments) {
    const fullPath = path.join(process.cwd(), att.path);
    if (!fs.existsSync(fullPath)) continue;

    if (IMAGE_TYPES.includes(att.mimetype)) {
      const result = await processImage(fullPath, att.filename, att.mimetype);
      contentBlocks.push(result.contentBlock);
      metadata.push({
        filename: att.filename,
        mimetype: att.mimetype,
        path: att.path,
        description: result.description,
      });
    } else if (att.mimetype === "application/pdf") {
      const result = await processPdf(fullPath, att.filename, sanitisationMap);
      contentBlocks.push(result.contentBlock);
      metadata.push({
        filename: att.filename,
        mimetype: att.mimetype,
        path: att.path,
        description: result.description,
      });
    }
  }

  return { contentBlocks, metadata };
}

async function processImage(
  filePath: string,
  filename: string,
  mimetype: string
): Promise<{ contentBlock: ContentBlockParam; description?: string }> {
  const lmAvailable = await checkLmStudioHealth();

  if (lmAvailable) {
    try {
      const description = await describeImageLocally(filePath);
      return {
        contentBlock: {
          type: "text",
          text: `[Attached image: ${filename}]\nImage description: ${description}`,
        },
        description,
      };
    } catch {
      // Fall through to direct send
    }
  }

  // Fallback: send base64 image directly to Claude
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString("base64");
  return {
    contentBlock: {
      type: "image",
      source: {
        type: "base64",
        media_type: mimetype as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
        data: base64,
      },
    } as unknown as ContentBlockParam,
  };
}

async function describeImageLocally(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString("base64");
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png"
    : ext === ".webp" ? "image/webp"
    : "image/jpeg";

  const client = getLmStudioClient();
  const response = await client.chat.completions.create({
    model: process.env.LMSTUDIO_CHAT_MODEL || "qwen3.5-9b",
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: "text", text: IMAGE_DESCRIBE_PROMPT },
        ],
      },
    ],
    max_tokens: 1024,
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content ?? "Unable to describe image.";
}

async function processPdf(
  filePath: string,
  filename: string,
  sanitisationMap: SanitisationMap
): Promise<{ contentBlock: ContentBlockParam; description: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParse = (await import("pdf-parse") as any).default ?? (await import("pdf-parse"));
  const buffer = fs.readFileSync(filePath);
  const result = await pdfParse(buffer);
  const rawText = result.text.slice(0, 20000);
  const sanitisedText = sanitise(rawText, sanitisationMap);

  return {
    contentBlock: {
      type: "text",
      text: `[Attached PDF: ${filename}]\nExtracted text:\n${sanitisedText}`,
    },
    description: `PDF document (${result.numpages} pages): ${rawText.slice(0, 200)}...`,
  };
}
