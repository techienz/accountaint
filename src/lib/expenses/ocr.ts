import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required");
  }
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export type OcrResult = {
  vendor: string | null;
  date: string | null; // YYYY-MM-DD
  amount: number | null; // GST-inclusive total
  gst_amount: number | null;
  category: string | null;
  confidence: "high" | "medium" | "low";
};

export async function extractReceiptData(
  imageBuffer: Buffer,
  mimeType: string
): Promise<OcrResult | null> {
  try {
    const mediaType = mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    const base64 = imageBuffer.toString("base64");

    const response = await getClient().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
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
              text: `Extract the following information from this receipt/invoice image. Return a JSON object with these fields:
- vendor: the business name on the receipt (string or null)
- date: the date in YYYY-MM-DD format (string or null)
- amount: the total amount including GST in NZD (number or null)
- gst_amount: the GST amount if shown (number or null)
- category: one of: office_supplies, travel, meals_entertainment, professional_fees, software_subscriptions, vehicle, home_office, utilities, insurance, bank_fees, other (string or null)
- confidence: "high" if all key fields are clearly readable, "medium" if some fields are uncertain, "low" if the image is unclear

Return ONLY the JSON object, no other text.`,
            },
          ],
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON from response, handling potential markdown code blocks
    const jsonStr = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonStr);

    return {
      vendor: parsed.vendor || null,
      date: parsed.date || null,
      amount: typeof parsed.amount === "number" ? parsed.amount : null,
      gst_amount: typeof parsed.gst_amount === "number" ? parsed.gst_amount : null,
      category: parsed.category || null,
      confidence: parsed.confidence || "low",
    };
  } catch (error) {
    console.error("[ocr] Receipt extraction failed:", error);
    return null;
  }
}
