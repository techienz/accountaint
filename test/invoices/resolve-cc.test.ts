import { describe, expect, it } from "vitest";
import { resolveCcRecipients } from "@/lib/invoices/resolve-cc";

describe("resolveCcRecipients", () => {
  it("falls back to contact CCs when caller passes undefined", () => {
    const out = resolveCcRecipients(undefined, "a@x.com, b@x.com");
    expect(out).toEqual(["a@x.com", "b@x.com"]);
  });

  it("treats explicit [] as 'no CCs' — does NOT fall back to contact", () => {
    // Regression: the user just removed the CCs from the send dialog. Adding
    // them back from the contact behind their back would be a privacy bug.
    const out = resolveCcRecipients([], "a@x.com, b@x.com");
    expect(out).toBeUndefined();
  });

  it("uses the explicit array verbatim when provided", () => {
    const out = resolveCcRecipients(["c@x.com"], "a@x.com, b@x.com");
    expect(out).toEqual(["c@x.com"]);
  });

  it("trims whitespace and drops empty strings in explicit list", () => {
    const out = resolveCcRecipients(["  a@x.com ", "", "  "], null);
    expect(out).toEqual(["a@x.com"]);
  });

  it("returns undefined when explicit list is only whitespace/empty", () => {
    const out = resolveCcRecipients(["", "   "], "ignored@x.com");
    expect(out).toBeUndefined();
  });

  it("returns undefined when neither explicit nor contact CCs", () => {
    expect(resolveCcRecipients(undefined, null)).toBeUndefined();
    expect(resolveCcRecipients(undefined, "")).toBeUndefined();
    expect(resolveCcRecipients(undefined, "  ,  ,  ")).toBeUndefined();
  });

  it("trims contact CC entries", () => {
    const out = resolveCcRecipients(undefined, " a@x.com ,  b@x.com  ");
    expect(out).toEqual(["a@x.com", "b@x.com"]);
  });
});
