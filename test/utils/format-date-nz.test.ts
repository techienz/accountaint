import { describe, it, expect } from "vitest";
import { formatDateNzDash } from "@/lib/utils/format-date-nz";

describe("formatDateNzDash", () => {
  it("formats YYYY-MM-DD as DD-MM-YYYY", () => {
    expect(formatDateNzDash("2026-05-02")).toBe("02-05-2026");
    expect(formatDateNzDash("2026-04-07")).toBe("07-04-2026");
  });

  it("returns empty string for null/undefined/empty", () => {
    expect(formatDateNzDash(null)).toBe("");
    expect(formatDateNzDash(undefined)).toBe("");
    expect(formatDateNzDash("")).toBe("");
  });

  it("returns the input unchanged for non-matching strings", () => {
    expect(formatDateNzDash("not-a-date")).toBe("not-a-date");
    expect(formatDateNzDash("2026-5-2")).toBe("2026-5-2");
    expect(formatDateNzDash("02-05-2026")).toBe("02-05-2026");
  });

  it("preserves zero-padding (boundary)", () => {
    expect(formatDateNzDash("2026-01-01")).toBe("01-01-2026");
    expect(formatDateNzDash("2026-12-31")).toBe("31-12-2026");
  });
});
