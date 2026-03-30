import type { Change } from "./diff";
import type { XeroEntityType, XeroInvoice } from "@/lib/xero/types";

export type DetectedAnomaly = {
  severity: "info" | "warning" | "critical";
  category: string;
  title: string;
  description: string;
  entity_id: string | null;
  suggested_question: string | null;
};

/**
 * Rule-based anomaly detection on a set of changes.
 * Returns anomalies to be stored in the database.
 */
export function analyseChanges(
  changes: Change[],
  entityType: XeroEntityType,
  fromData: unknown,
  toData: unknown,
  _businessId: string
): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  // Rule 1: Large round amounts (invoices)
  if (entityType === "invoices") {
    anomalies.push(...checkRoundAmounts(changes));
    anomalies.push(...checkDuplicateInvoices(toData));
    anomalies.push(...checkWeekendDates(toData));
  }

  // Rule 4: Category changes
  anomalies.push(...checkCategoryChanges(changes));

  // Rule 5: Significant amount changes
  anomalies.push(...checkSignificantAmountChanges(changes));

  // Rule 6: Deleted items
  anomalies.push(...checkDeletedItems(changes, entityType));

  // Rule 7: P&L line item variance
  if (entityType === "profit_loss" || entityType === "balance_sheet") {
    anomalies.push(...checkReportVariance(changes));
  }

  return anomalies;
}

function checkRoundAmounts(changes: Change[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  for (const change of changes) {
    if (change.type !== "added" && change.type !== "modified") continue;
    if (change.field !== "invoice" && change.field !== "total") continue;

    const valueStr = change.new_value || "";
    const match = valueStr.match(/\$([0-9,.]+)/);
    if (!match) continue;

    const amount = parseFloat(match[1].replace(/,/g, ""));
    if (amount >= 1000 && amount % 100 === 0) {
      anomalies.push({
        severity: "info",
        category: "round_amount",
        title: `Round amount: $${amount.toFixed(2)}`,
        description: change.description,
        entity_id: change.entity_id,
        suggested_question: `I noticed a ${change.type === "added" ? "new" : "modified"} invoice for exactly $${amount.toFixed(2)}. Could you help me understand what this is for?`,
      });
    }
  }

  return anomalies;
}

function checkDuplicateInvoices(toData: unknown): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];
  const d = toData as { Invoices?: XeroInvoice[] };
  const invoices = d?.Invoices ?? [];

  // Group by contact + amount
  const groups = new Map<string, XeroInvoice[]>();
  for (const inv of invoices) {
    const key = `${inv.Contact.ContactID}:${inv.Total}`;
    const group = groups.get(key) || [];
    group.push(inv);
    groups.set(key, group);
  }

  for (const [, group] of groups) {
    if (group.length < 2) continue;

    // Check if any pair is within 7 days
    for (let i = 0; i < group.length - 1; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const d1 = new Date(group[i].Date).getTime();
        const d2 = new Date(group[j].Date).getTime();
        const daysDiff = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);

        if (daysDiff <= 7) {
          anomalies.push({
            severity: "warning",
            category: "duplicate",
            title: `Possible duplicate: ${group[i].InvoiceNumber} & ${group[j].InvoiceNumber}`,
            description: `Two invoices to ${group[i].Contact.Name} for $${group[i].Total.toFixed(2)} within ${Math.round(daysDiff)} days`,
            entity_id: group[j].InvoiceID,
            suggested_question: `I noticed two invoices to ${group[i].Contact.Name} for the same amount ($${group[i].Total.toFixed(2)}) within a week — ${group[i].InvoiceNumber} and ${group[j].InvoiceNumber}. Could you confirm these are both correct?`,
          });
        }
      }
    }
  }

  return anomalies;
}

function checkWeekendDates(toData: unknown): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];
  const d = toData as { Invoices?: XeroInvoice[] };
  const invoices = d?.Invoices ?? [];

  for (const inv of invoices) {
    const date = new Date(inv.Date);
    const day = date.getDay();
    if (day === 0 || day === 6) {
      anomalies.push({
        severity: "info",
        category: "timing",
        title: `Weekend date: ${inv.InvoiceNumber}`,
        description: `Invoice ${inv.InvoiceNumber} dated ${inv.Date} (${day === 0 ? "Sunday" : "Saturday"})`,
        entity_id: inv.InvoiceID,
        suggested_question: null,
      });
    }
  }

  return anomalies;
}

function checkCategoryChanges(changes: Change[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  for (const change of changes) {
    if (change.field !== "account_code") continue;

    anomalies.push({
      severity: "warning",
      category: "category_change",
      title: `Category changed: ${change.old_value} → ${change.new_value}`,
      description: change.description,
      entity_id: change.entity_id,
      suggested_question: `${change.description.replace(/Invoice (\S+) line "(.+?)" reclassified from (.+) to (.+)/, 'Invoice $1 had a line item "$2" reclassified from $3 to $4. Could you help me understand why this expense category was changed?')}`,
    });
  }

  return anomalies;
}

function checkSignificantAmountChanges(changes: Change[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  for (const change of changes) {
    if (change.type !== "modified" || change.field !== "total") continue;

    const oldAmount = parseFloat((change.old_value || "0").replace(/[$,]/g, ""));
    const newAmount = parseFloat((change.new_value || "0").replace(/[$,]/g, ""));
    if (isNaN(oldAmount) || isNaN(newAmount)) continue;

    const diff = Math.abs(newAmount - oldAmount);
    const pctChange = oldAmount !== 0 ? (diff / Math.abs(oldAmount)) * 100 : 100;

    if (pctChange > 10 || diff > 500) {
      anomalies.push({
        severity: "warning",
        category: "amount_change",
        title: `Amount changed by ${pctChange.toFixed(0)}% ($${diff.toFixed(2)})`,
        description: change.description,
        entity_id: change.entity_id,
        suggested_question: `${change.description}. Could you help me understand what prompted this change?`,
      });
    }
  }

  return anomalies;
}

function checkDeletedItems(changes: Change[], entityType: XeroEntityType): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  for (const change of changes) {
    if (change.type !== "removed") continue;

    const label = entityType === "invoices" ? "invoice" : entityType === "contacts" ? "contact" : "item";
    anomalies.push({
      severity: "warning",
      category: "deleted_item",
      title: `${label.charAt(0).toUpperCase() + label.slice(1)} removed`,
      description: change.description,
      entity_id: change.entity_id,
      suggested_question: `I noticed that a ${label} (${change.old_value || "unknown"}) was removed. Could you help me understand why it was deleted?`,
    });
  }

  return anomalies;
}

function checkReportVariance(changes: Change[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  for (const change of changes) {
    if (change.type !== "modified") continue;

    const oldVal = parseFloat((change.old_value || "0").replace(/[,$]/g, ""));
    const newVal = parseFloat((change.new_value || "0").replace(/[,$]/g, ""));
    if (isNaN(oldVal) || isNaN(newVal) || oldVal === 0) continue;

    const pctChange = Math.abs((newVal - oldVal) / Math.abs(oldVal)) * 100;
    if (pctChange > 20) {
      anomalies.push({
        severity: "warning",
        category: "amount_change",
        title: `${change.field} changed by ${pctChange.toFixed(0)}%`,
        description: change.description,
        entity_id: null,
        suggested_question: `The "${change.field}" line changed by ${pctChange.toFixed(0)}% (from ${change.old_value} to ${change.new_value}). Could you help me understand what caused this change?`,
      });
    }
  }

  return anomalies;
}
