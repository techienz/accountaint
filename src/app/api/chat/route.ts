import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { buildSanitisationMap, sanitise } from "@/lib/ai/sanitise";
import { streamChat, buildAnthropicMessages } from "@/lib/ai/claude";
import { embedChatMessage } from "@/lib/ai/memory";
import { processAttachments } from "@/lib/ai/attachments";
import { hasXeroConnection } from "@/lib/xero/status";
import { listContacts } from "@/lib/contacts";
import { decrypt } from "@/lib/encryption";
import type { XeroContact } from "@/lib/xero/types";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json(
      { error: "No active business selected" },
      { status: 400 }
    );
  }

  let body: {
    message: string;
    pageContext?: {
      pageId: string;
      title: string;
      description: string;
      dataSummary?: string;
    };
    webSearchEnabled?: boolean;
    attachments?: {
      filename: string;
      mimetype: string;
      path: string;
      messageId: string;
    }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { message } = body;
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 }
    );
  }

  const trimmedMessage = message.trim().slice(0, 10000);
  const db = getDb();

  // Load contacts for sanitisation — local contacts first, Xero supplement
  const xeroConnected = hasXeroConnection(business.id);
  const localContacts = listContacts(business.id);
  const localAsXero: XeroContact[] = localContacts.map((c) => ({
    ContactID: c.id,
    Name: c.name,
    EmailAddress: c.email || "",
    IsSupplier: c.type === "supplier" || c.type === "both",
    IsCustomer: c.type === "customer" || c.type === "both",
    ContactStatus: "ACTIVE" as const,
  }));

  let xeroContacts: XeroContact[] = [];
  if (xeroConnected) {
    const contactsCache = db
      .select()
      .from(schema.xeroCache)
      .where(
        and(
          eq(schema.xeroCache.business_id, business.id),
          eq(schema.xeroCache.entity_type, "contacts")
        )
      )
      .get();
    const contactsRaw = contactsCache ? JSON.parse(contactsCache.data) : {};
    xeroContacts = Array.isArray(contactsRaw?.Contacts) ? contactsRaw.Contacts : Array.isArray(contactsRaw) ? contactsRaw : [];
  }

  const contacts: XeroContact[] = [...localAsXero, ...xeroContacts];
  const sanitisationMap = buildSanitisationMap(contacts);

  // Sanitise user message
  const sanitisedMessage = sanitise(trimmedMessage, sanitisationMap);

  // Save user message
  const userMessageId = uuid();
  db.insert(schema.chatMessages)
    .values({
      id: userMessageId,
      business_id: business.id,
      role: "user",
      content: trimmedMessage,
      sanitised_content: sanitisedMessage,
    })
    .run();

  // Fire-and-forget: embed user message for chat memory
  embedChatMessage(userMessageId, business.id, "user", trimmedMessage).catch(() => {});

  // Process attachments if any
  let attachmentContentBlocks: import("@anthropic-ai/sdk/resources/messages").ContentBlockParam[] = [];
  let attachmentMeta: { filename: string; mimetype: string; path: string; description?: string }[] = [];
  if (body.attachments && body.attachments.length > 0) {
    const processed = await processAttachments(body.attachments, sanitisationMap);
    attachmentContentBlocks = processed.contentBlocks;
    attachmentMeta = processed.metadata;

    // Update the message with attachment metadata
    db.update(schema.chatMessages)
      .set({ attachments: JSON.stringify(attachmentMeta) })
      .where(eq(schema.chatMessages.id, userMessageId))
      .run();
  }

  // Load chat history (last 20 messages)
  const history = db
    .select()
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.business_id, business.id))
    .orderBy(desc(schema.chatMessages.created_at))
    .limit(20)
    .all()
    .reverse();

  // Build Anthropic messages from history
  const anthropicMessages = buildAnthropicMessages(history);

  // Stream response
  const stream = streamChat({
    messages: anthropicMessages,
    userQuery: trimmedMessage,
    businessId: business.id,
    userId: session.user.id,
    business: {
      name: business.name,
      entity_type: business.entity_type,
      balance_date: business.balance_date,
      gst_registered: business.gst_registered,
      gst_filing_period: business.gst_filing_period,
      gst_basis: business.gst_basis,
      xeroConnected,
    },
    sanitisationMap,
    pageContext: body.pageContext || null,
    webSearchEnabled: body.webSearchEnabled || false,
    attachmentContentBlocks,
  });

  // Collect the full response to save to DB
  const [streamForClient, streamForSave] = stream.tee();

  // Save assistant message in background
  saveAssistantMessage(streamForSave, business.id).catch(() => {
    // Silently fail — the response was still streamed to the client
  });

  return new Response(streamForClient, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function saveAssistantMessage(
  stream: ReadableStream<Uint8Array>,
  businessId: string
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      // Parse SSE events
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "text") {
              fullText += event.content;
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (fullText.trim()) {
    const db = getDb();
    const assistantMsgId = uuid();
    db.insert(schema.chatMessages)
      .values({
        id: assistantMsgId,
        business_id: businessId,
        role: "assistant",
        content: fullText,
        sanitised_content: null,
      })
      .run();

    // Fire-and-forget: embed assistant message for chat memory
    embedChatMessage(assistantMsgId, businessId, "assistant", fullText).catch(() => {});
  }
}
