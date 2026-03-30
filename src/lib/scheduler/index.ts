import cron from "node-cron";
import { syncAllXeroData, checkDeadlines, checkContractRenewals, checkWorkContractExpiry, checkKnowledgeFreshness, checkOverdueInvoices, checkUpcomingBills } from "./jobs";

let started = false;

export function startScheduler() {
  if (started) return;
  started = true;

  console.log("[scheduler] Starting scheduler...");

  // Hourly Xero sync (at minute 0)
  cron.schedule("0 * * * *", async () => {
    console.log("[scheduler] Running Xero sync...");
    await syncAllXeroData();
  });

  // Hourly deadline check (at minute 30)
  cron.schedule("30 * * * *", async () => {
    console.log("[scheduler] Checking deadlines...");
    await checkDeadlines();
  });

  // Daily contract renewal check (at 8:00 AM)
  cron.schedule("0 8 * * *", async () => {
    console.log("[scheduler] Checking contract renewals...");
    await checkContractRenewals();
  });

  // Daily work contract expiry check (at 8:15 AM)
  cron.schedule("15 8 * * *", async () => {
    console.log("[scheduler] Checking work contract expiry...");
    await checkWorkContractExpiry();
  });

  // Daily overdue invoice check (at 9:00 AM)
  cron.schedule("0 9 * * *", async () => {
    console.log("[scheduler] Checking for overdue invoices...");
    await checkOverdueInvoices();
  });

  // Daily bill reminder check (at 7:00 AM)
  cron.schedule("0 7 * * *", async () => {
    console.log("[scheduler] Checking upcoming bills...");
    await checkUpcomingBills();
  });

  // Weekly knowledge freshness check (Sunday 3am)
  cron.schedule("0 3 * * 0", async () => {
    console.log("[scheduler] Checking knowledge freshness...");
    await checkKnowledgeFreshness();
  });

  console.log("[scheduler] Scheduler started");
}
