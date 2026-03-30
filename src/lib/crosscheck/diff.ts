import type { XeroEntityType } from "@/lib/xero/types";
import { parseReportSections } from "@/lib/reports/parsers";
import type { XeroReport, XeroInvoice, XeroContact, XeroBankAccount } from "@/lib/xero/types";

export type Change = {
  type: "added" | "removed" | "modified";
  entity_id: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  description: string;
};

/**
 * Dispatch to the correct diff function based on entity type.
 */
export function diffSnapshots(
  entityType: XeroEntityType,
  fromData: unknown,
  toData: unknown
): Change[] {
  switch (entityType) {
    case "invoices":
      return diffInvoices(fromData, toData);
    case "profit_loss":
    case "balance_sheet":
      return diffReport(fromData, toData, entityType);
    case "contacts":
      return diffContacts(fromData, toData);
    case "bank_accounts":
      return diffBankAccounts(fromData, toData);
    default:
      return [];
  }
}

function extractInvoices(data: unknown): XeroInvoice[] {
  const d = data as { Invoices?: XeroInvoice[] };
  return d?.Invoices ?? [];
}

function diffInvoices(fromData: unknown, toData: unknown): Change[] {
  const changes: Change[] = [];
  const fromInvoices = extractInvoices(fromData);
  const toInvoices = extractInvoices(toData);

  const fromMap = new Map(fromInvoices.map((i) => [i.InvoiceID, i]));
  const toMap = new Map(toInvoices.map((i) => [i.InvoiceID, i]));

  // New invoices
  for (const [id, inv] of toMap) {
    if (!fromMap.has(id)) {
      changes.push({
        type: "added",
        entity_id: id,
        field: "invoice",
        old_value: null,
        new_value: `${inv.InvoiceNumber} - $${inv.Total.toFixed(2)}`,
        description: `New invoice ${inv.InvoiceNumber} (${inv.Type === "ACCREC" ? "sales" : "purchase"}) for $${inv.Total.toFixed(2)} to ${inv.Contact.Name}`,
      });
    }
  }

  // Removed/voided invoices
  for (const [id, inv] of fromMap) {
    if (!toMap.has(id)) {
      changes.push({
        type: "removed",
        entity_id: id,
        field: "invoice",
        old_value: `${inv.InvoiceNumber} - $${inv.Total.toFixed(2)}`,
        new_value: null,
        description: `Invoice ${inv.InvoiceNumber} removed or voided ($${inv.Total.toFixed(2)})`,
      });
    }
  }

  // Modified invoices
  for (const [id, toInv] of toMap) {
    const fromInv = fromMap.get(id);
    if (!fromInv) continue;

    if (fromInv.Total !== toInv.Total) {
      changes.push({
        type: "modified",
        entity_id: id,
        field: "total",
        old_value: `$${fromInv.Total.toFixed(2)}`,
        new_value: `$${toInv.Total.toFixed(2)}`,
        description: `Invoice ${toInv.InvoiceNumber} total changed from $${fromInv.Total.toFixed(2)} to $${toInv.Total.toFixed(2)}`,
      });
    }

    if (fromInv.Status !== toInv.Status) {
      changes.push({
        type: "modified",
        entity_id: id,
        field: "status",
        old_value: fromInv.Status,
        new_value: toInv.Status,
        description: `Invoice ${toInv.InvoiceNumber} status changed from ${fromInv.Status} to ${toInv.Status}`,
      });
    }

    if (fromInv.Contact.Name !== toInv.Contact.Name) {
      changes.push({
        type: "modified",
        entity_id: id,
        field: "contact",
        old_value: fromInv.Contact.Name,
        new_value: toInv.Contact.Name,
        description: `Invoice ${toInv.InvoiceNumber} contact changed from ${fromInv.Contact.Name} to ${toInv.Contact.Name}`,
      });
    }

    // Check line item category changes
    const fromLines = fromInv.LineItems ?? [];
    const toLines = toInv.LineItems ?? [];
    for (let i = 0; i < Math.max(fromLines.length, toLines.length); i++) {
      const fromLine = fromLines[i];
      const toLine = toLines[i];
      if (fromLine && toLine && fromLine.AccountCode !== toLine.AccountCode) {
        changes.push({
          type: "modified",
          entity_id: id,
          field: "account_code",
          old_value: fromLine.AccountCode,
          new_value: toLine.AccountCode,
          description: `Invoice ${toInv.InvoiceNumber} line "${toLine.Description}" reclassified from ${fromLine.AccountCode} to ${toLine.AccountCode}`,
        });
      }
    }
  }

  return changes;
}

function extractReport(data: unknown): XeroReport | null {
  const d = data as { Reports?: XeroReport[] };
  return d?.Reports?.[0] ?? null;
}

function diffReport(
  fromData: unknown,
  toData: unknown,
  entityType: string
): Change[] {
  const changes: Change[] = [];
  const fromReport = extractReport(fromData);
  const toReport = extractReport(toData);
  if (!fromReport || !toReport) return changes;

  const fromSections = parseReportSections(fromReport);
  const toSections = parseReportSections(toReport);

  const reportLabel = entityType === "profit_loss" ? "P&L" : "Balance Sheet";

  // Build maps of section -> row -> value
  const fromValues = buildReportValueMap(fromSections.sections);
  const toValues = buildReportValueMap(toSections.sections);

  // Compare
  for (const [key, toVal] of toValues) {
    const fromVal = fromValues.get(key);
    if (fromVal === undefined) {
      changes.push({
        type: "added",
        entity_id: null,
        field: key,
        old_value: null,
        new_value: toVal,
        description: `${reportLabel}: New line item "${key}" with value ${toVal}`,
      });
    } else if (fromVal !== toVal) {
      const fromNum = parseFloat(fromVal.replace(/[,$]/g, ""));
      const toNum = parseFloat(toVal.replace(/[,$]/g, ""));
      let pctChange = "";
      if (!isNaN(fromNum) && !isNaN(toNum) && fromNum !== 0) {
        const pct = ((toNum - fromNum) / Math.abs(fromNum)) * 100;
        pctChange = ` (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)`;
      }
      changes.push({
        type: "modified",
        entity_id: null,
        field: key,
        old_value: fromVal,
        new_value: toVal,
        description: `${reportLabel}: "${key}" changed from ${fromVal} to ${toVal}${pctChange}`,
      });
    }
  }

  for (const [key, fromVal] of fromValues) {
    if (!toValues.has(key)) {
      changes.push({
        type: "removed",
        entity_id: null,
        field: key,
        old_value: fromVal,
        new_value: null,
        description: `${reportLabel}: Line item "${key}" removed (was ${fromVal})`,
      });
    }
  }

  return changes;
}

function buildReportValueMap(
  sections: { title: string; rows: { label: string; values: string[] }[]; summaryRow?: { label: string; values: string[] } }[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const section of sections) {
    for (const row of section.rows) {
      if (row.label && row.values[0]) {
        map.set(`${section.title} > ${row.label}`, row.values[0]);
      }
    }
    if (section.summaryRow?.values[0]) {
      map.set(`${section.title} > ${section.summaryRow.label}`, section.summaryRow.values[0]);
    }
  }
  return map;
}

function extractContacts(data: unknown): XeroContact[] {
  const d = data as { Contacts?: XeroContact[] };
  return d?.Contacts ?? [];
}

function diffContacts(fromData: unknown, toData: unknown): Change[] {
  const changes: Change[] = [];
  const fromContacts = extractContacts(fromData);
  const toContacts = extractContacts(toData);

  const fromMap = new Map(fromContacts.map((c) => [c.ContactID, c]));
  const toMap = new Map(toContacts.map((c) => [c.ContactID, c]));

  for (const [id, contact] of toMap) {
    if (!fromMap.has(id)) {
      changes.push({
        type: "added",
        entity_id: id,
        field: "contact",
        old_value: null,
        new_value: contact.Name,
        description: `New contact added: ${contact.Name}`,
      });
    }
  }

  for (const [id, contact] of fromMap) {
    if (!toMap.has(id)) {
      changes.push({
        type: "removed",
        entity_id: id,
        field: "contact",
        old_value: contact.Name,
        new_value: null,
        description: `Contact removed: ${contact.Name}`,
      });
    }
  }

  for (const [id, toContact] of toMap) {
    const fromContact = fromMap.get(id);
    if (!fromContact) continue;

    if (fromContact.Name !== toContact.Name) {
      changes.push({
        type: "modified",
        entity_id: id,
        field: "name",
        old_value: fromContact.Name,
        new_value: toContact.Name,
        description: `Contact name changed from "${fromContact.Name}" to "${toContact.Name}"`,
      });
    }

    if (fromContact.ContactStatus !== toContact.ContactStatus) {
      changes.push({
        type: "modified",
        entity_id: id,
        field: "status",
        old_value: fromContact.ContactStatus,
        new_value: toContact.ContactStatus,
        description: `Contact ${toContact.Name} status changed from ${fromContact.ContactStatus} to ${toContact.ContactStatus}`,
      });
    }
  }

  return changes;
}

function extractBankAccounts(data: unknown): XeroBankAccount[] {
  const d = data as { Accounts?: XeroBankAccount[] };
  return d?.Accounts ?? [];
}

function diffBankAccounts(fromData: unknown, toData: unknown): Change[] {
  const changes: Change[] = [];
  const fromAccounts = extractBankAccounts(fromData);
  const toAccounts = extractBankAccounts(toData);

  const fromMap = new Map(fromAccounts.map((a) => [a.AccountID, a]));
  const toMap = new Map(toAccounts.map((a) => [a.AccountID, a]));

  for (const [id, account] of toMap) {
    if (!fromMap.has(id)) {
      changes.push({
        type: "added",
        entity_id: id,
        field: "bank_account",
        old_value: null,
        new_value: account.Name,
        description: `New bank account added: ${account.Name}`,
      });
    }
  }

  for (const [id, account] of fromMap) {
    if (!toMap.has(id)) {
      changes.push({
        type: "removed",
        entity_id: id,
        field: "bank_account",
        old_value: account.Name,
        new_value: null,
        description: `Bank account removed: ${account.Name}`,
      });
    }
  }

  for (const [id, toAccount] of toMap) {
    const fromAccount = fromMap.get(id);
    if (!fromAccount) continue;

    if (fromAccount.Status !== toAccount.Status) {
      changes.push({
        type: "modified",
        entity_id: id,
        field: "status",
        old_value: fromAccount.Status,
        new_value: toAccount.Status,
        description: `Bank account ${toAccount.Name} status changed from ${fromAccount.Status} to ${toAccount.Status}`,
      });
    }
  }

  return changes;
}
