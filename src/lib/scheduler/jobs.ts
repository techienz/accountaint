import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { calculateDeadlines } from "@/lib/tax/deadlines";
import { notify } from "@/lib/notifications";
import { v4 as uuid } from "uuid";
import { getExpiringContracts, updateContractStatuses } from "@/lib/contracts";
import { getExpiringWorkContracts, updateWorkContractStatuses } from "@/lib/work-contracts";
import { updateOverdueInvoices, listInvoices } from "@/lib/invoices";
// Dynamic imports to avoid LanceDB native binding crash at startup
// import { getKnowledgeStatus } from "@/lib/knowledge/status";
// import { ingestAllGuides } from "@/lib/knowledge/ingest";
import { getOrCreateBudgetConfig, listRecurringItems } from "@/lib/budget";
import { getItemsDueInPeriod, getCurrentPayPeriod } from "@/lib/budget/calculations";

export async function syncAllXeroData() {
  const db = getDb();
  const connections = db.select().from(schema.xeroConnections).all();

  for (const conn of connections) {
    try {
      const { syncAllData } = await import("@/lib/xero/sync");
      await syncAllData(conn.business_id);
      console.log(`[scheduler] Xero sync complete for business ${conn.business_id}`);

      // Run cross-check change detection after sync
      try {
        const { detectChanges } = await import("@/lib/crosscheck/detect");
        const reportIds = await detectChanges(conn.business_id);
        if (reportIds.length > 0) {
          console.log(`[scheduler] Cross-check: ${reportIds.length} change report(s) for business ${conn.business_id}`);
        }
      } catch (detectError) {
        console.error(`[scheduler] Cross-check failed for business ${conn.business_id}:`, detectError);
      }
    } catch (error) {
      console.error(`[scheduler] Xero sync failed for business ${conn.business_id}:`, error);
    }
  }
}

export async function checkDeadlines() {
  const db = getDb();
  const businesses = db.select().from(schema.businesses).all();

  const now = new Date();
  const sevenDaysOut = new Date(now);
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

  for (const biz of businesses) {
    try {
      const deadlines = calculateDeadlines({
        entity_type: biz.entity_type as "company" | "sole_trader" | "partnership" | "trust",
        balance_date: biz.balance_date,
        gst_registered: biz.gst_registered,
        gst_filing_period: biz.gst_filing_period as "monthly" | "2monthly" | "6monthly" | undefined,
        has_employees: biz.has_employees,
        paye_frequency: biz.paye_frequency as "monthly" | "twice_monthly" | undefined,
        provisional_tax_method: biz.provisional_tax_method as "standard" | "estimation" | "aim" | undefined,
        dateRange: { from: now, to: sevenDaysOut },
      });

      for (const deadline of deadlines) {
        const existing = db
          .select()
          .from(schema.deadlines)
          .where(eq(schema.deadlines.due_date, deadline.dueDate))
          .get();

        if (existing?.notified) continue;

        await notify({
          businessId: biz.id,
          userId: biz.owner_user_id,
          title: `${deadline.description} due ${new Date(deadline.dueDate).toLocaleDateString("en-NZ")}`,
          body: `Your ${deadline.type} obligation is due soon.`,
          vagueTitle: "Tax deadline approaching",
          vagueBody: "You have an upcoming tax obligation.",
          type: "deadline",
        });

        db.insert(schema.deadlines)
          .values({
            id: uuid(),
            business_id: biz.id,
            type: deadline.type as "gst" | "provisional_tax" | "income_tax" | "paye" | "ird_filing",
            description: deadline.description,
            due_date: deadline.dueDate,
            tax_year: String(deadline.taxYear),
            status: "due_soon",
            notified: true,
          })
          .run();
      }
    } catch (error) {
      console.error(`[scheduler] Deadline check failed for business ${biz.id}:`, error);
    }
  }
}

export async function checkContractRenewals() {
  const db = getDb();
  const businesses = db.select().from(schema.businesses).all();

  for (const biz of businesses) {
    try {
      // Update contract statuses first
      updateContractStatuses(biz.id);

      // Find contracts expiring within 30 days
      const expiring = getExpiringContracts(biz.id, 30);

      for (const contract of expiring) {
        // Skip if already notified recently (within 7 days)
        if (contract.renewal_notified_at) {
          const daysSinceNotified = (Date.now() - new Date(contract.renewal_notified_at).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceNotified < 7) continue;
        }

        await notify({
          businessId: biz.id,
          userId: biz.owner_user_id,
          title: `Contract expiring: ${contract.service_name} (${contract.provider}) renews ${contract.renewal_date}`,
          body: `Your ${contract.billing_cycle} contract for ${contract.service_name} is due for renewal.`,
          vagueTitle: "Contract renewal approaching",
          vagueBody: "You have a contract expiring soon.",
          type: "alert",
        });

        // Update renewal_notified_at
        db.update(schema.contracts)
          .set({ renewal_notified_at: new Date() })
          .where(eq(schema.contracts.id, contract.id))
          .run();
      }
    } catch (error) {
      console.error(`[scheduler] Contract renewal check failed for business ${biz.id}:`, error);
    }
  }
}

export async function checkWorkContractExpiry() {
  const db = getDb();
  const businesses = db.select().from(schema.businesses).all();

  for (const biz of businesses) {
    try {
      updateWorkContractStatuses(biz.id);

      const expiring = getExpiringWorkContracts(biz.id, 30);

      for (const contract of expiring) {
        if (contract.expiry_notified_at) {
          const daysSinceNotified = (Date.now() - new Date(contract.expiry_notified_at).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceNotified < 7) continue;
        }

        await notify({
          businessId: biz.id,
          userId: biz.owner_user_id,
          title: `Work contract expiring: ${contract.client_name} ends ${contract.end_date}`,
          body: `Your ${contract.contract_type} contract with ${contract.client_name} is ending soon.`,
          vagueTitle: "Work contract expiring soon",
          vagueBody: "You have a work contract ending soon.",
          type: "alert",
        });

        db.update(schema.workContracts)
          .set({ expiry_notified_at: new Date() })
          .where(eq(schema.workContracts.id, contract.id))
          .run();
      }
    } catch (error) {
      console.error(`[scheduler] Work contract expiry check failed for business ${biz.id}:`, error);
    }
  }
}

export async function checkKnowledgeFreshness() {
  try {
    const { getKnowledgeStatus } = await import("@/lib/knowledge/status");
    const status = await getKnowledgeStatus();

    if (status.freshnessState === "stale") {
      console.log(`[scheduler] Knowledge base is stale (${status.daysSinceUpdate}d since update)`);

      // Notify all business owners
      const db = getDb();
      const businesses = db.select().from(schema.businesses).all();
      for (const biz of businesses) {
        await notify({
          businessId: biz.id,
          userId: biz.owner_user_id,
          title: "Tax knowledge base needs updating",
          body: `IRD guides were last updated ${status.daysSinceUpdate} days ago. Consider running an update.`,
          vagueTitle: "Knowledge update available",
          vagueBody: "Your tax knowledge base may be out of date.",
          type: "alert",
        });
      }

      // Auto-reingest if configured
      if (process.env.AUTO_REINGEST_KNOWLEDGE === "true") {
        console.log("[scheduler] Auto-reingesting knowledge base...");
        const { ingestAllGuides } = await import("@/lib/knowledge/ingest");
        const count = await ingestAllGuides();
        console.log(`[scheduler] Knowledge base updated: ${count} chunks`);
      }
    } else {
      console.log(`[scheduler] Knowledge base is ${status.freshnessState} (${status.daysSinceUpdate ?? 0}d)`);
    }
  } catch (error) {
    console.error("[scheduler] Knowledge freshness check failed:", error);
  }
}

export async function checkUpcomingBills() {
  const db = getDb();
  const users = db.select().from(schema.users).all();

  for (const user of users) {
    try {
      const config = getOrCreateBudgetConfig(user.id);
      const items = listRecurringItems(user.id).filter((i) => i.is_active);
      if (items.length === 0) continue;

      // Find bills due in the next 3 days
      const now = new Date();
      const threeDaysOut = new Date(now);
      threeDaysOut.setDate(threeDaysOut.getDate() + 3);

      const period = getCurrentPayPeriod(config);
      const dueItems = getItemsDueInPeriod(items, { start: now, end: threeDaysOut });

      if (dueItems.length === 0) continue;

      // Use user's first business as notification anchor
      const userBiz = db
        .select()
        .from(schema.businesses)
        .where(eq(schema.businesses.owner_user_id, user.id))
        .limit(1)
        .all();
      if (userBiz.length === 0) continue;

      const names = dueItems.map((i) => i.name).join(", ");
      await notify({
        businessId: userBiz[0].id,
        userId: user.id,
        title: `${dueItems.length} bill(s) due soon: ${names}`,
        body: `You have upcoming personal bills in the next 3 days.`,
        vagueTitle: "Bills due soon",
        vagueBody: "You have upcoming personal bills.",
        type: "alert",
      });
    } catch (error) {
      console.error(`[scheduler] Bill reminder check failed for user ${user.id}:`, error);
    }
  }
}

export async function checkOverdueInvoices() {
  const db = getDb();
  const businesses = db.select().from(schema.businesses).all();

  for (const biz of businesses) {
    try {
      // Update sent invoices past due_date to overdue
      const count = updateOverdueInvoices(biz.id);
      if (count > 0) {
        console.log(`[scheduler] Marked ${count} invoice(s) overdue for business ${biz.id}`);
      }

      // Notify for overdue invoices that haven't been notified recently
      const overdueInvoices = listInvoices(biz.id, { status: "overdue" });
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      for (const inv of overdueInvoices) {
        if (inv.overdue_notified_at && new Date(inv.overdue_notified_at) > sevenDaysAgo) {
          continue;
        }

        await notify({
          businessId: biz.id,
          userId: biz.owner_user_id,
          title: `Invoice ${inv.invoice_number} is overdue (due ${inv.due_date})`,
          body: `${inv.contact_name} owes $${inv.amount_due.toLocaleString("en-NZ", { minimumFractionDigits: 2 })}`,
          vagueTitle: "Invoice overdue",
          vagueBody: "You have an overdue invoice.",
          type: "alert",
        });

        // Mark as notified
        db.update(schema.invoices)
          .set({ overdue_notified_at: new Date() })
          .where(eq(schema.invoices.id, inv.id))
          .run();
      }
    } catch (error) {
      console.error(`[scheduler] Overdue invoice check failed for business ${biz.id}:`, error);
    }
  }
}

export async function syncAllAkahuData() {
  try {
    const { syncAllAkahu } = await import("@/lib/akahu/sync");
    await syncAllAkahu();
    console.log("[scheduler] Akahu sync complete");
  } catch (error) {
    console.error("[scheduler] Akahu sync failed:", error);
  }
}

export async function cleanupChatAttachments() {
  const db = getDb();
  const fsModule = await import("fs");
  const pathModule = await import("path");

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

  const allWithAttachments = db
    .select()
    .from(schema.chatMessages)
    .all()
    .filter((m) => m.attachments != null && m.created_at && m.created_at < cutoff);

  let cleaned = 0;
  for (const msg of allWithAttachments) {
    try {
      const attachments = JSON.parse(msg.attachments!) as { path: string }[];
      for (const att of attachments) {
        const fullPath = pathModule.join(process.cwd(), att.path);
        if (fsModule.existsSync(fullPath)) {
          fsModule.unlinkSync(fullPath);
        }
        const dir = pathModule.dirname(fullPath);
        try { fsModule.rmdirSync(dir); } catch { /* not empty or already gone */ }
      }

      db.update(schema.chatMessages)
        .set({ attachments: null })
        .where(eq(schema.chatMessages.id, msg.id))
        .run();
      cleaned++;
    } catch {
      // Skip individual failures
    }
  }

  console.log(`[scheduler] Cleaned up attachments from ${cleaned} messages`);
}
