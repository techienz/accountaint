ALTER TABLE `businesses` ADD `auto_invoice_reminders` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `invoice_reminder_cadence_days` integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `last_reminder_sent_at` integer;--> statement-breakpoint
ALTER TABLE `invoices` ADD `reminder_count` integer DEFAULT 0 NOT NULL;