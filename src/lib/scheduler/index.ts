import cron from "node-cron";
import {
  syncAllXeroData,
  checkDeadlines,
  checkContractRenewals,
  checkWorkContractExpiry,
  checkKnowledgeFreshness,
  checkOverdueInvoices,
  checkUpcomingBills,
  syncAllAkahuData,
  cleanupChatAttachments,
} from "./jobs";
import { runJob } from "./run-job";

let started = false;

export function startScheduler() {
  if (started) return;
  started = true;

  console.log("[scheduler] Starting scheduler...");

  // Hourly Xero sync (at minute 0)
  cron.schedule("0 * * * *", async () => {
    await runJob("xero_sync", syncAllXeroData);
  });

  // Hourly deadline check (at minute 30)
  cron.schedule("30 * * * *", async () => {
    await runJob("deadline_check", checkDeadlines);
  });

  // Daily contract renewal check (at 8:00 AM)
  cron.schedule("0 8 * * *", async () => {
    await runJob("contract_renewal_check", checkContractRenewals);
  });

  // Daily work contract expiry check (at 8:15 AM)
  cron.schedule("15 8 * * *", async () => {
    await runJob("work_contract_expiry_check", checkWorkContractExpiry);
  });

  // Daily overdue invoice check (at 9:00 AM)
  cron.schedule("0 9 * * *", async () => {
    await runJob("overdue_invoice_check", checkOverdueInvoices);
  });

  // Daily bill reminder check (at 7:00 AM)
  cron.schedule("0 7 * * *", async () => {
    await runJob("upcoming_bills_check", checkUpcomingBills);
  });

  // Akahu bank feed sync every 4 hours (at minute 15)
  cron.schedule("15 */4 * * *", async () => {
    await runJob("akahu_sync", syncAllAkahuData);
  });

  // Weekly knowledge freshness check (Sunday 3am)
  cron.schedule("0 3 * * 0", async () => {
    await runJob("knowledge_freshness_check", checkKnowledgeFreshness);
  });

  // Daily chat attachment cleanup (at 3:15 AM)
  cron.schedule("15 3 * * *", async () => {
    await runJob("chat_attachment_cleanup", cleanupChatAttachments);
  });

  // Monthly regulatory check (1st of month at 4:00 AM)
  cron.schedule("0 4 1 * *", async () => {
    await runJob("regulatory_check", async () => {
      const { runRegulatoryCheck, getLatestCheckRun } = await import("@/lib/regulatory/verify");
      await runRegulatoryCheck();
      const run = getLatestCheckRun();
      if (run && (run.areas_changed > 0 || run.areas_uncertain > 0)) {
        const { notify } = await import("@/lib/notifications");
        const { getDb, schema: s } = await import("@/lib/db");
        const db = getDb();
        const businesses = db.select().from(s.businesses).all();
        for (const biz of businesses) {
          await notify({
            businessId: biz.id,
            userId: biz.owner_user_id,
            title: "Regulatory update available",
            body: `${run.areas_changed} tax rule(s) may have changed. Review in Settings > Regulatory Updates.`,
            vagueTitle: "Regulatory update",
            vagueBody: "Tax rules may need updating",
            type: "alert",
          });
        }
      }
      console.log(`[scheduler] Regulatory check complete: ${run?.areas_checked} checked, ${run?.areas_changed} changed`);
    });
  });

  // Monthly tax optimisation scan (1st of month at 5:00 AM)
  cron.schedule("0 5 1 * *", async () => {
    await runJob("tax_optimisation_scan", async () => {
      const { runTaxOptimisationAnalysis } = await import("@/lib/tax/optimisation/analyse");
      const { getDb, schema: s } = await import("@/lib/db");
      const db = getDb();
      const businesses = db.select().from(s.businesses).all();
      for (const biz of businesses) {
        try {
          const result = await runTaxOptimisationAnalysis(biz.id);
          console.log(`[scheduler] Tax optimisation for ${biz.id}: ${result.recommendations.length} opportunities, $${Math.round(result.recommendations.reduce((s, r) => s + r.annualSaving, 0))} potential savings`);
        } catch (err) {
          console.error(`[scheduler] Tax optimisation failed for ${biz.id}:`, err);
        }
      }
    });
  });

  // Weekly tax optimisation scan near balance date (every Monday at 5:30 AM, only runs if within 60 days of balance date)
  cron.schedule("30 5 * * 1", async () => {
    await runJob("pre_balance_tax_optimisation", async () => {
      const { getDb, schema: s } = await import("@/lib/db");
      const { getNzTaxYear } = await import("@/lib/tax/rules");
      const db = getDb();
      const businesses = db.select().from(s.businesses).all();
      const now = new Date();

      for (const biz of businesses) {
        const taxYear = getNzTaxYear(now);
        const balanceDate = new Date(`${taxYear}-${biz.balance_date || "03-31"}`);
        const daysToBalance = Math.ceil((balanceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysToBalance > 0 && daysToBalance <= 60) {
          console.log(`[scheduler] Balance date in ${daysToBalance} days for ${biz.id}, running tax optimisation...`);
          const { runTaxOptimisationAnalysis } = await import("@/lib/tax/optimisation/analyse");
          try {
            await runTaxOptimisationAnalysis(biz.id);
          } catch (err) {
            console.error(`[scheduler] Pre-balance tax optimisation failed for ${biz.id}:`, err);
          }
        }
      }
    });
  });

  console.log("[scheduler] Scheduler started");
}
