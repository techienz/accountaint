import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  suggestMatches,
  matchTransaction,
  createAndMatch,
  unmatchTransaction,
  reconcileTransaction,
  excludeTransaction,
  getReconciliationStatus,
  applyReconciliationRules,
  createReconciliationRule,
  listReconciliationRules,
  deleteReconciliationRule,
} from "@/lib/ledger/reconciliation";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";

/** GET: Get reconciliation status + unmatched transactions */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = session.activeBusiness.id;
  const action = request.nextUrl.searchParams.get("action");

  if (action === "rules") {
    return NextResponse.json(listReconciliationRules(businessId));
  }

  if (action === "suggest") {
    const txnId = request.nextUrl.searchParams.get("txnId");
    if (!txnId) return NextResponse.json({ error: "txnId required" }, { status: 400 });
    return NextResponse.json(suggestMatches(businessId, txnId));
  }

  // Default: return status + transactions
  const status = getReconciliationStatus(businessId);

  const db = getDb();
  const transactions = db
    .select()
    .from(schema.bankTransactions)
    .where(eq(schema.bankTransactions.business_id, businessId))
    .all()
    .map((t) => ({
      ...t,
      description: decrypt(t.description),
      merchant_name: t.merchant_name ? decrypt(t.merchant_name) : null,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json({ status, transactions });
}

/** POST: Perform reconciliation actions */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = session.activeBusiness.id;
  const body = await request.json();
  const { action } = body;

  switch (action) {
    case "match": {
      const { bankTransactionId, journalEntryId } = body;
      const result = matchTransaction(businessId, bankTransactionId, journalEntryId);
      return NextResponse.json({
        success: result.success,
        linkedInvoice: result.linkedInvoice ?? null,
      });
    }

    case "create_and_match": {
      const { bankTransactionId, accountCode, description, gstInclusive } = body;
      const entryId = createAndMatch(
        businessId,
        bankTransactionId,
        accountCode,
        description,
        gstInclusive
      );
      return NextResponse.json({ success: !!entryId, journalEntryId: entryId });
    }

    case "unmatch": {
      const ok = unmatchTransaction(businessId, body.bankTransactionId);
      return NextResponse.json({ success: ok });
    }

    case "reconcile": {
      const result = reconcileTransaction(businessId, body.bankTransactionId);
      return NextResponse.json({
        success: result.success,
        linkedInvoice: result.linkedInvoice ?? null,
      });
    }

    case "exclude": {
      const ok = excludeTransaction(businessId, body.bankTransactionId);
      return NextResponse.json({ success: ok });
    }

    case "apply_rules": {
      const matched = applyReconciliationRules(businessId);
      return NextResponse.json({ matched });
    }

    case "create_rule": {
      const { matchPattern, accountId, descriptionTemplate, gstInclusive } = body;
      const ruleId = createReconciliationRule(businessId, {
        match_pattern: matchPattern,
        account_id: accountId,
        description_template: descriptionTemplate,
        gst_inclusive: gstInclusive,
      });
      return NextResponse.json({ id: ruleId });
    }

    case "delete_rule": {
      const ok = deleteReconciliationRule(businessId, body.ruleId);
      return NextResponse.json({ success: ok });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
