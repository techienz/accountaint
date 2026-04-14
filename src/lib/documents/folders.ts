import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/encryption";

type FolderInput = {
  name: string;
  icon?: string | null;
};

const SYSTEM_FOLDERS = [
  { name: "Receipts", icon: "🧾", sort_order: 0 },
  { name: "Bank Receipts", icon: "🏦", sort_order: 1 },
  { name: "Tax Returns", icon: "📋", sort_order: 2 },
  { name: "IRD Guides", icon: "📚", sort_order: 3 },
];

/**
 * Seed default system folders for a business (idempotent).
 */
export function seedSystemFolders(businessId: string): void {
  const db = getDb();
  for (const folder of SYSTEM_FOLDERS) {
    const existing = db
      .select()
      .from(schema.documentFolders)
      .where(
        and(
          eq(schema.documentFolders.business_id, businessId),
          eq(schema.documentFolders.is_system, true),
          eq(schema.documentFolders.sort_order, folder.sort_order)
        )
      )
      .get();

    if (!existing) {
      db.insert(schema.documentFolders)
        .values({
          id: uuid(),
          business_id: businessId,
          name: encrypt(folder.name),
          icon: folder.icon,
          is_system: true,
          sort_order: folder.sort_order,
        })
        .run();
    }
  }
}

/**
 * List all folders for a business with document counts.
 */
export function listFolders(businessId: string) {
  const db = getDb();

  seedSystemFolders(businessId);

  const folders = db
    .select()
    .from(schema.documentFolders)
    .where(eq(schema.documentFolders.business_id, businessId))
    .all()
    .map((f) => ({ ...f, name: decrypt(f.name) }))
    .sort((a, b) => a.sort_order - b.sort_order);

  // Count documents per folder
  const docs = db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.business_id, businessId))
    .all();

  const counts = new Map<string, number>();
  let unfiledCount = 0;
  for (const doc of docs) {
    if (doc.folder_id) {
      counts.set(doc.folder_id, (counts.get(doc.folder_id) || 0) + 1);
    } else {
      unfiledCount++;
    }
  }

  return {
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      icon: f.icon,
      isSystem: f.is_system,
      documentCount: counts.get(f.id) || 0,
    })),
    totalDocuments: docs.length,
    unfiledCount,
  };
}

/**
 * Create a custom folder.
 */
export function createFolder(businessId: string, data: FolderInput) {
  const db = getDb();
  const id = uuid();
  const maxSort = db
    .select()
    .from(schema.documentFolders)
    .where(eq(schema.documentFolders.business_id, businessId))
    .all()
    .reduce((max, f) => Math.max(max, f.sort_order), -1);

  db.insert(schema.documentFolders)
    .values({
      id,
      business_id: businessId,
      name: encrypt(data.name),
      icon: data.icon ?? "📁",
      is_system: false,
      sort_order: maxSort + 1,
    })
    .run();

  return { id, name: data.name, icon: data.icon ?? "📁", isSystem: false, documentCount: 0 };
}

/**
 * Rename a folder (custom folders only).
 */
export function updateFolder(id: string, businessId: string, data: Partial<FolderInput>) {
  const db = getDb();
  const folder = db
    .select()
    .from(schema.documentFolders)
    .where(and(eq(schema.documentFolders.id, id), eq(schema.documentFolders.business_id, businessId)))
    .get();

  if (!folder) return null;

  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = encrypt(data.name);
  if (data.icon !== undefined) updates.icon = data.icon;

  db.update(schema.documentFolders)
    .set(updates)
    .where(eq(schema.documentFolders.id, id))
    .run();

  return { id, name: data.name ?? decrypt(folder.name), icon: data.icon ?? folder.icon };
}

/**
 * Delete a custom folder (system folders can't be deleted).
 * Documents in the folder become unfiled.
 */
export function deleteFolder(id: string, businessId: string): boolean {
  const db = getDb();
  const folder = db
    .select()
    .from(schema.documentFolders)
    .where(and(eq(schema.documentFolders.id, id), eq(schema.documentFolders.business_id, businessId)))
    .get();

  if (!folder || folder.is_system) return false;

  // Unfiled documents in this folder
  db.update(schema.documents)
    .set({ folder_id: null })
    .where(eq(schema.documents.folder_id, id))
    .run();

  db.delete(schema.documentFolders)
    .where(eq(schema.documentFolders.id, id))
    .run();

  return true;
}

/**
 * Get or create a folder by name (used by upload flows).
 */
export function getOrCreateFolder(businessId: string, name: string): string {
  const db = getDb();
  seedSystemFolders(businessId);

  const folders = db
    .select()
    .from(schema.documentFolders)
    .where(eq(schema.documentFolders.business_id, businessId))
    .all();

  const match = folders.find((f) => decrypt(f.name).toLowerCase() === name.toLowerCase());
  if (match) return match.id;

  const result = createFolder(businessId, { name });
  return result.id;
}
