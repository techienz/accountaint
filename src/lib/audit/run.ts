import type { Check, CheckResult } from "./types";
import { trialBalanceCheck, journalEntryBalanceCheck } from "./checks/ledger";
import { tenancyIntegrityCheck } from "./checks/tenancy";
import { encryptionDecryptCheck } from "./checks/encryption";
import { orphanTimesheetCheck, orphanInvoiceLineCheck } from "./checks/orphans";
import { akahuSyncFreshnessCheck } from "./checks/sync";
import { knowledgeIndexCheck } from "./checks/knowledge";
import { emailSuccessRateCheck } from "./checks/email";
import { schedulerHeartbeatCheck } from "./checks/scheduler";

export const ALL_CHECKS: Check[] = [
  trialBalanceCheck,
  journalEntryBalanceCheck,
  tenancyIntegrityCheck,
  encryptionDecryptCheck,
  orphanTimesheetCheck,
  orphanInvoiceLineCheck,
  akahuSyncFreshnessCheck,
  schedulerHeartbeatCheck,
  knowledgeIndexCheck,
  emailSuccessRateCheck,
];

export async function runAllChecks(businessId: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const check of ALL_CHECKS) {
    const start = Date.now();
    try {
      const partial = await check.run(businessId);
      results.push({
        name: check.name,
        category: check.category,
        duration_ms: Date.now() - start,
        ...partial,
      });
    } catch (err) {
      results.push({
        name: check.name,
        category: check.category,
        status: "fail",
        message: `Check threw: ${err instanceof Error ? err.message : String(err)}`,
        duration_ms: Date.now() - start,
      });
    }
  }
  return results;
}

export type AuditSummary = {
  total: number;
  pass: number;
  warn: number;
  fail: number;
  duration_ms: number;
};

export function summarise(results: CheckResult[]): AuditSummary {
  return {
    total: results.length,
    pass: results.filter((r) => r.status === "pass").length,
    warn: results.filter((r) => r.status === "warn").length,
    fail: results.filter((r) => r.status === "fail").length,
    duration_ms: results.reduce((s, r) => s + r.duration_ms, 0),
  };
}
