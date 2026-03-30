import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/encryption";

type ContactType = "customer" | "supplier" | "both";

type ContactInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  tax_number?: string | null;
  type?: ContactType;
  default_due_days?: number;
  notes?: string | null;
};

type ContactFilters = {
  type?: ContactType;
};

function decryptContact(row: typeof schema.contacts.$inferSelect) {
  return {
    ...row,
    name: decrypt(row.name),
    email: row.email ? decrypt(row.email) : null,
    phone: row.phone ? decrypt(row.phone) : null,
    address: row.address ? decrypt(row.address) : null,
    tax_number: row.tax_number ? decrypt(row.tax_number) : null,
  };
}

export function listContacts(businessId: string, filters?: ContactFilters) {
  const db = getDb();
  const conditions = [eq(schema.contacts.business_id, businessId)];
  if (filters?.type) {
    conditions.push(eq(schema.contacts.type, filters.type));
  }

  const rows = db
    .select()
    .from(schema.contacts)
    .where(and(...conditions))
    .all();

  return rows
    .map(decryptContact)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getContact(id: string, businessId: string) {
  const db = getDb();
  const row = db
    .select()
    .from(schema.contacts)
    .where(
      and(
        eq(schema.contacts.id, id),
        eq(schema.contacts.business_id, businessId)
      )
    )
    .get();
  if (!row) return null;
  return decryptContact(row);
}

export function createContact(businessId: string, data: ContactInput) {
  const db = getDb();
  const id = uuid();

  db.insert(schema.contacts)
    .values({
      id,
      business_id: businessId,
      name: encrypt(data.name),
      email: data.email ? encrypt(data.email) : null,
      phone: data.phone ? encrypt(data.phone) : null,
      address: data.address ? encrypt(data.address) : null,
      tax_number: data.tax_number ? encrypt(data.tax_number) : null,
      type: data.type ?? "customer",
      default_due_days: data.default_due_days ?? 20,
      notes: data.notes ?? null,
    })
    .run();

  return getContact(id, businessId);
}

export function updateContact(
  id: string,
  businessId: string,
  data: Partial<ContactInput>
) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.contacts)
    .where(
      and(
        eq(schema.contacts.id, id),
        eq(schema.contacts.business_id, businessId)
      )
    )
    .get();
  if (!existing) return null;

  const updates: Record<string, unknown> = { updated_at: new Date() };

  if (data.name !== undefined) updates.name = encrypt(data.name);
  if (data.email !== undefined) updates.email = data.email ? encrypt(data.email) : null;
  if (data.phone !== undefined) updates.phone = data.phone ? encrypt(data.phone) : null;
  if (data.address !== undefined) updates.address = data.address ? encrypt(data.address) : null;
  if (data.tax_number !== undefined) updates.tax_number = data.tax_number ? encrypt(data.tax_number) : null;
  if (data.type !== undefined) updates.type = data.type;
  if (data.default_due_days !== undefined) updates.default_due_days = data.default_due_days;
  if (data.notes !== undefined) updates.notes = data.notes;

  db.update(schema.contacts)
    .set(updates)
    .where(
      and(
        eq(schema.contacts.id, id),
        eq(schema.contacts.business_id, businessId)
      )
    )
    .run();

  return getContact(id, businessId);
}

export function deleteContact(id: string, businessId: string) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.contacts)
    .where(
      and(
        eq(schema.contacts.id, id),
        eq(schema.contacts.business_id, businessId)
      )
    )
    .get();
  if (!existing) return false;

  const result = db
    .delete(schema.contacts)
    .where(
      and(
        eq(schema.contacts.id, id),
        eq(schema.contacts.business_id, businessId)
      )
    )
    .run();
  return result.changes > 0;
}

export function findOrCreateContactByName(businessId: string, name: string, type: ContactType = "customer") {
  const contacts = listContacts(businessId);
  const existing = contacts.find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  );
  if (existing) return existing;
  return createContact(businessId, { name, type });
}
