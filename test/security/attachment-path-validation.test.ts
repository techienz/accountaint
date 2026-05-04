import { describe, expect, it } from "vitest";
import path from "node:path";
import { resolveChatAttachmentPath, getChatAttachmentsDir } from "@/lib/storage/paths";

/**
 * Path-traversal guard for chat attachments. Audit finding #63 (2026-05-01).
 *
 * Pre-storage-paths refactor, the guard was a module-private isPathSafe in
 * src/lib/ai/attachments.ts that resolved relative to cwd and required the
 * result to live under data/chat-attachments. The refactor replaced that
 * with the public resolveChatAttachmentPath helper exported from
 * src/lib/storage/paths.ts. Same policy, fewer copies.
 *
 * The helper accepts both legacy ("data/chat-attachments/...") and current
 * (no-prefix) DB-stored shapes for backward compat. Returns null for any
 * unsafe input.
 */

const ROOT = getChatAttachmentsDir();

describe("Chat attachment path validation (audit #63)", () => {
  describe("legitimate paths resolve to a path under the attachments root", () => {
    it("legacy form with data/chat-attachments/ prefix", () => {
      const r = resolveChatAttachmentPath("data/chat-attachments/biz1/msg-abc/file.pdf");
      expect(r).not.toBeNull();
      if (r) expect(r.startsWith(ROOT + path.sep)).toBe(true);
    });

    it("current form without the data/ prefix", () => {
      const r = resolveChatAttachmentPath("biz1/msg-abc/file.pdf");
      expect(r).not.toBeNull();
      if (r) expect(r.startsWith(ROOT + path.sep)).toBe(true);
    });

    it("nested business + message paths", () => {
      const r = resolveChatAttachmentPath("business-abc/2026-05-01/file.pdf");
      expect(r).not.toBeNull();
    });
  });

  describe("attack paths return null", () => {
    it("rejects ../ traversal to .env", () => {
      expect(resolveChatAttachmentPath("data/chat-attachments/../../.env")).toBeNull();
      expect(resolveChatAttachmentPath("../.env")).toBeNull();
      expect(resolveChatAttachmentPath("../../.env")).toBeNull();
    });

    it("rejects traversal to the SQLite DB", () => {
      expect(resolveChatAttachmentPath("data/chat-attachments/../accountaint.db")).toBeNull();
      expect(resolveChatAttachmentPath("../data/accountaint.db")).toBeNull();
    });

    it("rejects absolute paths", () => {
      expect(resolveChatAttachmentPath("/etc/passwd")).toBeNull();
      expect(resolveChatAttachmentPath("/home/kurt/.ssh/id_rsa")).toBeNull();
      expect(resolveChatAttachmentPath("/proc/self/environ")).toBeNull();
    });

    it("rejects empty / null / non-string inputs", () => {
      expect(resolveChatAttachmentPath("")).toBeNull();
      expect(resolveChatAttachmentPath(null as unknown as string)).toBeNull();
      expect(resolveChatAttachmentPath(undefined as unknown as string)).toBeNull();
      expect(resolveChatAttachmentPath(123 as unknown as string)).toBeNull();
    });

    it("rejects the root itself (must be a file inside, not the root)", () => {
      expect(resolveChatAttachmentPath("data/chat-attachments")).toBeNull();
      expect(resolveChatAttachmentPath("data/chat-attachments/")).toBeNull();
    });

    it("encoded traversal segments are treated as literal filenames (no URL decoding)", () => {
      // path.resolve doesn't URL-decode, so %2e%2e becomes a literal "%2e%2e"
      // path segment. That's safe — it stays inside ATTACHMENT_ROOT and the
      // existsSync check in attachments.ts is the second layer.
      const r = resolveChatAttachmentPath("biz1/%2e%2e/.env");
      expect(r).not.toBeNull();
    });
  });
});
