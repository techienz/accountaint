import { describe, expect, it } from "vitest";
import { searchKnowledge } from "@/lib/tax/knowledge/search";

/**
 * Issue #85 — verifies the Investment Boost knowledge chunk is loaded
 * by the keyword-fallback retriever (used when LM Studio + LanceDB are
 * unavailable).
 */
describe("knowledge: investment-boost chunk is discoverable", () => {
  it("returns the IB chunk for an 'Investment Boost' query", () => {
    const results = searchKnowledge("Investment Boost", 3);
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.chunk.chunk_id).toBe("investment-boost");
    expect(top.chunk.guide).toBe("IB2025");
  });

  it("surfaces IB content (not just metadata) so the LLM can ground answers", () => {
    const results = searchKnowledge("Investment Boost 20% new asset", 3);
    const top = results.find((r) => r.chunk.chunk_id === "investment-boost");
    expect(top).toBeDefined();
    expect(top!.chunk.content).toMatch(/22 May 2025/);
    expect(top!.chunk.content).toMatch(/20%/);
    expect(top!.chunk.content).toMatch(/residential/i);
  });
});
