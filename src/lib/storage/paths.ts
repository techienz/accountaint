import fs from "fs";
import path from "path";

/**
 * Single source of truth for on-disk storage roots (receipts, documents,
 * chat attachments).
 *
 * Why this exists: every direct caller used to do
 * `path.join(process.cwd(), "data", "...")`. Inside the production Docker
 * container, `process.cwd() === /app`, but `/app/data` is NOT bind-mounted
 * — only `/data` is. So every uploaded file lived in an ephemeral container
 * directory and was wiped on every `docker compose up -d` recreate. Three
 * subsystems were affected: receipts, documents, chat attachments.
 *
 * The fix: resolve all storage dirs relative to a single `STORAGE_ROOT`
 * env var. In dev that defaults to `<cwd>/data`. In container we set
 * `STORAGE_ROOT=/data`, matching the bind mount.
 */
function getStorageRoot(): string {
  const fromEnv = process.env.STORAGE_ROOT;
  if (fromEnv && fromEnv.length > 0) return path.resolve(fromEnv);
  return path.join(process.cwd(), "data");
}

function getDir(name: string): string {
  const dir = path.join(getStorageRoot(), name);
  // mkdir -p on first access. Cheap, and avoids EACCES on first-upload
  // for self-hosters who don't pre-create the subdirs.
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getReceiptsDir(): string {
  return getDir("receipts");
}

export function getDocumentsDir(): string {
  return getDir("documents");
}

export function getChatAttachmentsDir(): string {
  return getDir("chat-attachments");
}

export function getHolidayAttachmentsDir(): string {
  return getDir("holiday-attachments");
}

export function getLogosDir(): string {
  return getDir("logos");
}

/** Storage root itself — for callers that already have a sub-relative path. */
export function getStorageRootDir(): string {
  return getStorageRoot();
}

/**
 * Resolve a DB-stored chat-attachment path to an absolute filesystem path.
 *
 * Historically (pre-#???) the path was stored with a "data/" prefix
 * because it was constructed as `path.join("data/chat-attachments", ...)`
 * relative to cwd. Going forward we store paths without that prefix
 * (just `<biz>/<msg>/<file>`). To keep old DB rows resolvable, this helper
 * accepts either form by stripping a leading "data/chat-attachments/" or
 * "chat-attachments/" segment and joining to the current chat-attachments
 * dir.
 *
 * Returns `null` if the supplied path resolves outside the attachments
 * dir (path-traversal defence).
 */
export function resolveChatAttachmentPath(stored: string): string | null {
  if (!stored || typeof stored !== "string") return null;
  if (path.isAbsolute(stored)) return null;

  const root = getChatAttachmentsDir();
  // Strip legacy prefixes if present so callers can pass either a
  // pre-fix or post-fix shape.
  // Match the prefix optionally followed by a slash — so "data/chat-attachments"
  // and "data/chat-attachments/" both reduce to "" and get rejected as
  // pointing at the root rather than a file inside it.
  const stripped = stored
    .replace(/^data\/chat-attachments(\/|$)/, "")
    .replace(/^chat-attachments(\/|$)/, "");

  const resolved = path.resolve(root, stripped);
  const rel = path.relative(root, resolved);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return resolved;
}
