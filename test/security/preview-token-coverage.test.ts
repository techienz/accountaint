import { describe, expect, it } from "vitest";
import { chatTools } from "@/lib/ai/tools";

/**
 * Regression for audit #118 — these mutating chat tools MUST declare a
 * `preview_token` parameter so the AI can pass it back on the second call.
 * Without it, the dispatcher's two-step state machine has nothing to bind
 * the preview to and the safety reduces to soft-confirm-only.
 *
 * The dispatch case enforces the actual flow; this test enforces the
 * schema contract so adding a new mutating tool prompts a copy-paste of
 * the preview_token property.
 */
const PREVIEW_GATED_TOOLS = [
  "declare_dividend",
  "delete_timesheet_entries",
  "send_invoice_email",
  "finalise_pay_run",
  "email_payslips",
  "email_timesheet",
];

describe("preview_token coverage on mutating chat tools", () => {
  for (const name of PREVIEW_GATED_TOOLS) {
    it(`${name} declares preview_token in input_schema`, () => {
      const tool = chatTools.find((t) => t.name === name);
      expect(tool, `${name} must exist`).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const props = (tool as unknown as { input_schema: { properties: Record<string, any> } })
        .input_schema.properties;
      expect(props.preview_token, `${name} must have preview_token property`).toBeDefined();
      expect(props.preview_token.type).toBe("string");
    });

    it(`${name} description mentions the two-step / token pattern`, () => {
      const tool = chatTools.find((t) => t.name === name);
      const desc = (tool as unknown as { description: string }).description.toLowerCase();
      // Either "two-step" or "preview_token" or "preview token" should appear
      const hasGuidance = desc.includes("two-step") || desc.includes("preview_token") || desc.includes("preview token");
      expect(hasGuidance, `${name} description should explain the token flow`).toBe(true);
    });
  }
});
