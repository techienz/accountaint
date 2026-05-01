import { describe, expect, it, beforeEach } from "vitest";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import { v4 as uuid } from "uuid";

/**
 * Preview token state-machine tests. Audit finding #66 (2026-05-01).
 *
 * Sets up an in-memory DB to exercise the issue/consume flow without
 * touching the real DB. We re-implement the logic here because the
 * production module imports getDb() at module-load.
 */

function canonicalArgs(args: unknown): string {
  if (args === null || args === undefined) return "";
  if (typeof args !== "object") return JSON.stringify(args);
  const obj = args as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => k !== "preview_token" && k !== "confirm" && obj[k] !== undefined)
    .sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) sorted[k] = obj[k];
  return JSON.stringify(sorted);
}

function hashArgs(args: unknown): string {
  return crypto.createHash("sha256").update(canonicalArgs(args)).digest("hex");
}

describe("preview-token canonicalArgs hashing", () => {
  it("same args -> same hash regardless of key order", () => {
    expect(hashArgs({ a: 1, b: 2 })).toBe(hashArgs({ b: 2, a: 1 }));
  });

  it("ignores preview_token and confirm from the comparison", () => {
    expect(hashArgs({ a: 1 })).toBe(hashArgs({ a: 1, preview_token: "x" }));
    expect(hashArgs({ a: 1 })).toBe(hashArgs({ a: 1, confirm: true }));
  });

  it("different values -> different hash", () => {
    expect(hashArgs({ a: 1 })).not.toBe(hashArgs({ a: 2 }));
  });

  it("undefined values are ignored, null is not", () => {
    expect(hashArgs({ a: 1, b: undefined })).toBe(hashArgs({ a: 1 }));
    expect(hashArgs({ a: 1, b: null })).not.toBe(hashArgs({ a: 1 }));
  });
});

describe("preview-token consume() state machine", () => {
  let sqlite: Database.Database;

  function issue(businessId: string, userId: string, toolName: string, args: unknown, ttlMinutes = 5): string {
    const id = uuid();
    const now = Date.now();
    sqlite
      .prepare(`INSERT INTO preview_tokens (id, business_id, user_id, tool_name, args_hash, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`)
      .run(id, businessId, userId, toolName, hashArgs(args), Math.floor(now / 1000), Math.floor((now + ttlMinutes * 60_000) / 1000));
    return id;
  }

  type Reason = "missing" | "wrong_business" | "wrong_tool" | "args_changed" | "expired" | "already_used";
  function consume(token: string, businessId: string, toolName: string, args: unknown): { ok: true } | { ok: false; reason: Reason } {
    const row = sqlite.prepare(`SELECT * FROM preview_tokens WHERE id = ?`).get(token) as { id: string; business_id: string; user_id: string; tool_name: string; args_hash: string; expires_at: number; used_at: number | null } | undefined;
    if (!row) return { ok: false, reason: "missing" };
    if (row.business_id !== businessId) return { ok: false, reason: "wrong_business" };
    if (row.tool_name !== toolName) return { ok: false, reason: "wrong_tool" };
    if (row.used_at !== null) return { ok: false, reason: "already_used" };
    if (row.expires_at * 1000 < Date.now()) return { ok: false, reason: "expired" };
    if (row.args_hash !== hashArgs(args)) return { ok: false, reason: "args_changed" };
    const result = sqlite.prepare(`UPDATE preview_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL`).run(Math.floor(Date.now() / 1000), token);
    if (result.changes === 0) return { ok: false, reason: "already_used" };
    return { ok: true };
  }

  beforeEach(() => {
    sqlite = new Database(":memory:");
    sqlite.exec(`CREATE TABLE preview_tokens (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, user_id TEXT, tool_name TEXT NOT NULL, args_hash TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER);`);
  });

  it("happy path: issue then consume -> ok", () => {
    const tok = issue("biz1", "u1", "declare_dividend", { total_amount: 100, date: "2026-05-01" });
    expect(consume(tok, "biz1", "declare_dividend", { total_amount: 100, date: "2026-05-01" })).toEqual({ ok: true });
  });

  it("second consume of same token -> already_used", () => {
    const tok = issue("biz1", "u1", "tool", { x: 1 });
    consume(tok, "biz1", "tool", { x: 1 });
    expect(consume(tok, "biz1", "tool", { x: 1 })).toEqual({ ok: false, reason: "already_used" });
  });

  it("non-existent token -> missing", () => {
    expect(consume("does-not-exist", "biz1", "tool", {})).toEqual({ ok: false, reason: "missing" });
  });

  it("wrong business -> wrong_business (cross-tenant defence)", () => {
    const tok = issue("biz1", "u1", "tool", { x: 1 });
    expect(consume(tok, "biz-other", "tool", { x: 1 })).toEqual({ ok: false, reason: "wrong_business" });
  });

  it("wrong tool name -> wrong_tool (token bound to specific tool)", () => {
    const tok = issue("biz1", "u1", "declare_dividend", { x: 1 });
    expect(consume(tok, "biz1", "delete_timesheet_entries", { x: 1 })).toEqual({ ok: false, reason: "wrong_tool" });
  });

  it("args changed between preview and execute -> args_changed", () => {
    const tok = issue("biz1", "u1", "declare_dividend", { total_amount: 100 });
    expect(consume(tok, "biz1", "declare_dividend", { total_amount: 9999 })).toEqual({ ok: false, reason: "args_changed" });
  });

  it("expired token -> expired", () => {
    const tok = issue("biz1", "u1", "tool", {}, -1);
    expect(consume(tok, "biz1", "tool", {})).toEqual({ ok: false, reason: "expired" });
  });

  it("preview_token in args is stripped before hashing", () => {
    const tok = issue("biz1", "u1", "tool", { x: 1 });
    expect(consume(tok, "biz1", "tool", { x: 1, preview_token: tok })).toEqual({ ok: true });
  });
});
