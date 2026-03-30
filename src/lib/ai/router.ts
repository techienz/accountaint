import { checkLmStudioHealth } from "@/lib/lmstudio/client";

export type AiTask =
  | "tax_advice"
  | "ocr"
  | "categorisation"
  | "summarisation"
  | "embedding"
  | "analysis";

export type AiRoute = "local" | "claude_sonnet" | "claude_haiku";

const LOCAL_TASKS: Set<AiTask> = new Set([
  "ocr",
  "categorisation",
  "summarisation",
  "embedding",
]);

const SONNET_TASKS: Set<AiTask> = new Set([
  "tax_advice",
  "analysis",
]);

export async function routeTask(task: AiTask): Promise<AiRoute> {
  if (SONNET_TASKS.has(task)) {
    return "claude_sonnet";
  }

  if (LOCAL_TASKS.has(task)) {
    const available = await checkLmStudioHealth();
    return available ? "local" : "claude_haiku";
  }

  return "claude_sonnet";
}
