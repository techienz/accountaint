import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  getReceiptsDir,
  getDocumentsDir,
  getChatAttachmentsDir,
  getHolidayAttachmentsDir,
  getLogosDir,
  getStorageRootDir,
} from "@/lib/storage/paths";

/**
 * Storage root resolution. The fix introduced STORAGE_ROOT env var so that
 * the production container can point at the bind-mounted /data instead of
 * the ephemeral /app/data. These tests pin the contract: each subsystem
 * gets a deterministic absolute path under whatever STORAGE_ROOT resolves
 * to.
 *
 * STORAGE_ROOT is fixed here at module evaluation time (the helper reads
 * process.env every call, but vitest setup hasn't set STORAGE_ROOT, so we
 * test the dev default — cwd/data — by default).
 */

describe("storage paths", () => {
  it("getStorageRootDir returns an absolute path", () => {
    expect(path.isAbsolute(getStorageRootDir())).toBe(true);
  });

  it("each subsystem dir lives under the storage root", () => {
    const root = getStorageRootDir();
    for (const dir of [
      getReceiptsDir(),
      getDocumentsDir(),
      getChatAttachmentsDir(),
      getHolidayAttachmentsDir(),
      getLogosDir(),
    ]) {
      expect(dir.startsWith(root + path.sep)).toBe(true);
      expect(path.isAbsolute(dir)).toBe(true);
    }
  });

  it("subsystem dirs are distinct", () => {
    const dirs = new Set([
      getReceiptsDir(),
      getDocumentsDir(),
      getChatAttachmentsDir(),
      getHolidayAttachmentsDir(),
      getLogosDir(),
    ]);
    expect(dirs.size).toBe(5);
  });

  it("dev default falls back to cwd/data when STORAGE_ROOT is unset", () => {
    // vitest setup doesn't set STORAGE_ROOT, so this exercises the fallback.
    // (Container production uses STORAGE_ROOT=/data; that's verified manually.)
    if (!process.env.STORAGE_ROOT) {
      expect(getStorageRootDir()).toBe(path.join(process.cwd(), "data"));
    }
  });
});
