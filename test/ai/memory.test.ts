import { describe, expect, it } from "vitest";
import { formatMemoryChunks } from "@/lib/ai/memory";
import { buildSanitisationMap } from "@/lib/ai/sanitise";
import type { SanitisationMap } from "@/lib/ai/types";
import type { XeroContact } from "@/lib/xero/types";

/**
 * Audit #100 — chat memory chunks must be re-sanitised before they
 * land back in the system prompt. Stored content is the raw / desanitised
 * form (real names, IRD / bank numbers possible), so every retrieval
 * needs the current stream's sanitisation map applied.
 */

const ALICE: XeroContact = {
  ContactID: "c1",
  Name: "Alice Holdings Ltd",
  IsCustomer: true,
  IsSupplier: false,
} as XeroContact;

const BOB: XeroContact = {
  ContactID: "c2",
  Name: "Bob Supplies Ltd",
  IsCustomer: false,
  IsSupplier: true,
} as XeroContact;

const emptyMap: SanitisationMap = {
  originalToAnon: new Map(),
  anonToOriginal: new Map(),
};

describe("formatMemoryChunks", () => {
  it("anonymises contact names that appear in stored content", () => {
    const map = buildSanitisationMap([ALICE, BOB]);
    const out = formatMemoryChunks(
      [
        {
          role: "user",
          content: "Did Alice Holdings Ltd pay yet? And did we pay Bob Supplies Ltd?",
          createdAt: "2026-04-15T10:00:00.000Z",
        },
      ],
      map,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).not.toContain("Alice Holdings Ltd");
    expect(out[0]).not.toContain("Bob Supplies Ltd");
    expect(out[0]).toContain("Customer A");
    expect(out[0]).toContain("Supplier A");
  });

  it("scrubs IRD numbers regardless of map state", () => {
    const out = formatMemoryChunks(
      [
        {
          role: "assistant",
          content: "Your IRD number is 123-456-789.",
          createdAt: "2026-04-15T10:00:00.000Z",
        },
      ],
      emptyMap,
    );
    expect(out[0]).not.toContain("123-456-789");
    expect(out[0]).toContain("[IRD ***]");
  });

  it("scrubs bank-account numbers regardless of map state", () => {
    const out = formatMemoryChunks(
      [
        {
          role: "assistant",
          content: "Pay into 12-3456-7890123-00 by Friday.",
          createdAt: "2026-04-15T10:00:00.000Z",
        },
      ],
      emptyMap,
    );
    expect(out[0]).not.toContain("12-3456-7890123-00");
    expect(out[0]).toContain("[Bank ***]");
  });

  it("preserves the date prefix and role label", () => {
    const out = formatMemoryChunks(
      [
        {
          role: "assistant",
          content: "Your GST is due Monday.",
          createdAt: "2026-04-15T10:00:00.000Z",
        },
      ],
      emptyMap,
    );
    expect(out[0]).toMatch(/^\[2026-04-15\] assistant: Your GST is due Monday\.$/);
  });

  it("is a no-op for content that has nothing to sanitise", () => {
    const out = formatMemoryChunks(
      [
        {
          role: "user",
          content: "What's the company tax rate?",
          createdAt: "2026-04-15T10:00:00.000Z",
        },
      ],
      emptyMap,
    );
    expect(out[0]).toBe("[2026-04-15] user: What's the company tax rate?");
  });

  it("returns an empty array when there are no results", () => {
    expect(formatMemoryChunks([], emptyMap)).toEqual([]);
  });

  it("does not break stale anon labels left over from a prior session", () => {
    // Old assistant text says "Customer A" — the current map has no
    // matching contact name to substitute, so the token must pass
    // through unchanged. (Whether desanitise later re-binds it to
    // a different person is a separate concern, out of scope for #100.)
    const map = buildSanitisationMap([BOB]); // map only has Bob (Supplier A)
    const out = formatMemoryChunks(
      [
        {
          role: "assistant",
          content: "Customer A still owes you $500.",
          createdAt: "2026-04-15T10:00:00.000Z",
        },
      ],
      map,
    );
    expect(out[0]).toContain("Customer A still owes you $500.");
  });
});
