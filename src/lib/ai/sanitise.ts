import type { XeroContact } from "@/lib/xero/types";
import type { SanitisationMap } from "./types";

const CUSTOMER_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => `Customer ${l}`);
const SUPPLIER_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => `Supplier ${l}`);
const SHAREHOLDER_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => `Shareholder ${l}`);
const EMPLOYEE_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => `Employee ${l}`);

const IRD_REGEX = /\b\d{2,3}-?\d{3}-?\d{3}\b/g;
const BANK_REGEX = /\b\d{2}-?\d{4}-?\d{7}-?\d{2,3}\b/g;

export function buildSanitisationMap(
  contacts: XeroContact[],
  shareholderNames?: string[],
  employeeNames?: string[]
): SanitisationMap {
  const originalToAnon = new Map<string, string>();
  const anonToOriginal = new Map<string, string>();

  let customerIdx = 0;
  let supplierIdx = 0;

  for (const contact of contacts) {
    if (!contact.Name || originalToAnon.has(contact.Name)) continue;

    let label: string;
    if (contact.IsSupplier && !contact.IsCustomer) {
      label = SUPPLIER_LABELS[supplierIdx] || `Supplier ${supplierIdx + 1}`;
      supplierIdx++;
    } else {
      label = CUSTOMER_LABELS[customerIdx] || `Customer ${customerIdx + 1}`;
      customerIdx++;
    }

    originalToAnon.set(contact.Name, label);
    anonToOriginal.set(label, contact.Name);
  }

  // Anonymise shareholder names
  if (shareholderNames) {
    let shIdx = 0;
    for (const name of shareholderNames) {
      if (!name || originalToAnon.has(name)) continue;
      const label = SHAREHOLDER_LABELS[shIdx] || `Shareholder ${shIdx + 1}`;
      shIdx++;
      originalToAnon.set(name, label);
      anonToOriginal.set(label, name);
    }
  }

  // Anonymise employee names — issue #69. Without this the model received
  // employee names verbatim from get_employees / pay-run tools.
  if (employeeNames) {
    let empIdx = 0;
    for (const name of employeeNames) {
      if (!name || originalToAnon.has(name)) continue;
      const label = EMPLOYEE_LABELS[empIdx] || `Employee ${empIdx + 1}`;
      empIdx++;
      originalToAnon.set(name, label);
      anonToOriginal.set(label, name);
    }
  }

  return { originalToAnon, anonToOriginal };
}

export function sanitise(text: string, map: SanitisationMap): string {
  let result = text;

  // Pass 1: replace contact names (longest first to avoid partial matches)
  const names = [...map.originalToAnon.keys()].sort((a, b) => b.length - a.length);
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    result = result.replace(regex, map.originalToAnon.get(name)!);
  }

  // Pass 2: IRD numbers
  result = result.replace(IRD_REGEX, "[IRD ***]");

  // Pass 3: bank account numbers
  result = result.replace(BANK_REGEX, "[Bank ***]");

  return result;
}

export function desanitise(text: string, map: SanitisationMap): string {
  let result = text;

  // Replace anon labels with original names (longest first)
  const labels = [...map.anonToOriginal.keys()].sort((a, b) => b.length - a.length);
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "g");
    result = result.replace(regex, map.anonToOriginal.get(label)!);
  }

  return result;
}

/**
 * Strip unbounded-PII fields from an employee record before passing it to
 * the chat model (issue #69). The chat doesn't need raw email / phone /
 * DOB / address / IRD / emergency-contact data to give payroll or tax
 * advice — server-side handlers (payslip email, tax filing, etc.) look
 * these up by `id` from the DB. Returning them to Claude is pure leak
 * surface: `emergency_contact_name` in particular is another person's
 * name that's never in any sanitisation map.
 *
 * The employee's own `name` is kept here and anonymised downstream by
 * `sanitiseXeroData` once the employee is in the sanitisation map.
 */
export function redactEmployeeForChat<
  T extends {
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    date_of_birth?: string | null;
    ird_number?: string | null;
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
  }
>(employee: T): T {
  return {
    ...employee,
    email: null,
    phone: null,
    address: null,
    date_of_birth: null,
    ird_number: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
  };
}

export function sanitiseXeroData<T>(data: T, map: SanitisationMap): T {
  if (data === null || data === undefined) return data;
  if (typeof data === "string") return sanitise(data, map) as T;
  if (Array.isArray(data)) return data.map((item) => sanitiseXeroData(item, map)) as T;
  if (typeof data === "object") {
    const clone: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (key === "Name" || key === "ContactName") {
        clone[key] = typeof value === "string" ? sanitise(value, map) : value;
      } else {
        clone[key] = sanitiseXeroData(value, map);
      }
    }
    return clone as T;
  }
  return data;
}
