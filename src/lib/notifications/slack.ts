type SlackMessage = {
  title: string;
  body?: string;
  type?: string;
  businessName?: string;
};

/**
 * Send a notification to Slack via incoming webhook.
 * Uses Block Kit format for clean rendering.
 */
export async function sendSlack(
  webhookUrl: string,
  message: SlackMessage
): Promise<void> {
  const typeIcons: Record<string, string> = {
    deadline: ":calendar:",
    sync: ":arrows_counterclockwise:",
    tax: ":receipt:",
    alert: ":warning:",
    info: ":information_source:",
  };

  const icon = typeIcons[message.type || "info"] || ":bell:";

  const blocks: unknown[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${icon} ${message.title}`,
        emoji: true,
      },
    },
  ];

  if (message.body) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: message.body,
      },
    });
  }

  const contextElements: unknown[] = [
    {
      type: "mrkdwn",
      text: `<!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
    },
  ];

  if (message.businessName) {
    contextElements.push({
      type: "mrkdwn",
      text: `*${message.businessName}*`,
    });
  }

  blocks.push({
    type: "context",
    elements: contextElements,
  });

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed: ${response.status}`);
  }
}
