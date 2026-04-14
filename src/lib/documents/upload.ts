import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import * as fs from "fs";
import * as path from "path";
import { getOrCreateFolder } from "./folders";

const DATA_DIR = path.join(process.cwd(), "data", "documents");

type UploadOptions = {
  folderId?: string | null;
  folderName?: string | null; // alternative: find/create folder by name
  documentType?: string;
  taxYear?: string | null;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  description?: string | null;
};

type UploadFile = {
  name: string;
  type: string;
  buffer: Buffer;
};

/**
 * Unified document upload function.
 * All file uploads in the app should go through this.
 */
export function createDocumentFromUpload(
  businessId: string,
  file: UploadFile,
  options: UploadOptions = {}
): { id: string; filePath: string } {
  const db = getDb();
  const docId = uuid();
  const ext = file.name.split(".").pop() || "bin";
  const fileName = `${docId}.${ext}`;

  // Ensure directory
  const dir = path.join(DATA_DIR, businessId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Save file
  fs.writeFileSync(path.join(dir, fileName), file.buffer);

  // Resolve folder
  let folderId = options.folderId ?? null;
  if (!folderId && options.folderName) {
    folderId = getOrCreateFolder(businessId, options.folderName);
  }

  // Create document record
  db.insert(schema.documents)
    .values({
      id: docId,
      business_id: businessId,
      folder_id: folderId,
      name: encrypt(file.name),
      description: options.description ?? null,
      file_path: fileName,
      file_size: file.buffer.length,
      mime_type: file.type,
      document_type: (options.documentType as any) || "other",
      tax_year: options.taxYear ?? null,
      linked_entity_type: (options.linkedEntityType as any) ?? null,
      linked_entity_id: options.linkedEntityId ?? null,
      extraction_status: "pending",
    })
    .run();

  return { id: docId, filePath: fileName };
}
